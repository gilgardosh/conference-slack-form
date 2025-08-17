import { Router } from 'itty-router';
import type { 
  Env, 
  FormSubmissionResponse, 
  PingResponse,
} from './types';
import { 
  generateId, 
  jsonResponse, 
  errorResponse, 
} from './utils';
import { validateAndSanitize } from './utils/validation';
import { checkIpRateLimit, checkEmailRateLimit } from './lib/rateLimiter';
import { createSlackClient } from './lib/slack';
import { sendWelcomeEmail } from './lib/email';

// Create router instance
const router = Router();

/**
 * CORS preflight handler
 */
router.options('*', () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
});

/**
 * Health check endpoint
 * GET /api/ping
 */
router.get('/api/ping', (): Response => {
  const response: PingResponse = {
    ok: true,
    version: '0.1.0',
  };
  
  return jsonResponse(response);
});

/**
 * Sanitization preview endpoint
 * POST /api/sanitize-preview
 */
router.post('/api/sanitize-preview', async (request: Request): Promise<Response> => {
  try {
    // Parse request body
    let body: unknown;
    
    try {
      body = await request.json();
    } catch (error) {
      return errorResponse(
        'INVALID_JSON',
        'Invalid JSON in request body',
        400
      );
    }

    // Validate and sanitize input (without rate limit increment)
    const validationResult = validateAndSanitize(body);
    
    if (!validationResult.ok) {
      return new Response(JSON.stringify({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        errors: validationResult.errors
      }), {
        status: 422,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const { sanitizedCompanyName } = validationResult.value;

    return jsonResponse({
      ok: true,
      sanitizedCompanyName,
    });

  } catch (error) {
    console.error('Unexpected error in /api/sanitize-preview:', error);
    
    return errorResponse(
      'INTERNAL_ERROR',
      'Internal server error',
      500
    );
  }
});

/**
 * Form submission endpoint
 * POST /api/submit
 */
router.post('/api/submit', async (request: Request, env: Env): Promise<Response> => {
  try {
    // Get client IP address
    const clientIP = request.headers.get('CF-Connecting-IP') || 
                     request.headers.get('X-Forwarded-For') || 
                     'unknown';

    // Parse request body first
    let body: unknown;
    
    try {
      body = await request.json();
    } catch (error) {
      return errorResponse(
        'INVALID_JSON',
        'Invalid JSON in request body',
        400
      );
    }

    // 1. Validate and sanitize input
    const validationResult = validateAndSanitize(body);
    
    if (!validationResult.ok) {
      return new Response(JSON.stringify({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        errors: validationResult.errors
      }), {
        status: 422,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const { email, sanitizedCompanyName, companyName } = validationResult.value;

    // Get rate limit settings from environment with defaults
    const rateLimit = parseInt(env.RATE_LIMIT || '10', 10);
    const rateLimitWindowSec = parseInt(env.RATE_LIMIT_WINDOW_SEC || '3600', 10); // 1 hour default

    // 3. Rate-limit checks
    // Check IP rate limit
    const ipRateLimit = checkIpRateLimit(clientIP, rateLimit, rateLimitWindowSec);
    if (!ipRateLimit.allowed) {
      return new Response(JSON.stringify({
        ok: false,
        errorCode: 'rate_limit',
        message: 'Rate limit exceeded',
        metadata: {
          type: 'ip',
          remaining: ipRateLimit.remaining
        }
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'X-RateLimit-Limit': rateLimit.toString(),
          'X-RateLimit-Remaining': ipRateLimit.remaining.toString(),
          'X-RateLimit-Reset': Math.ceil(ipRateLimit.resetAt / 1000).toString(),
        },
      });
    }

    // Check email rate limit
    const emailRateLimit = checkEmailRateLimit(email, rateLimit, rateLimitWindowSec);
    if (!emailRateLimit.allowed) {
      return new Response(JSON.stringify({
        ok: false,
        errorCode: 'rate_limit',
        message: 'Rate limit exceeded',
        metadata: {
          type: 'email',
          remaining: emailRateLimit.remaining
        }
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'X-RateLimit-Limit': rateLimit.toString(),
          'X-RateLimit-Remaining': emailRateLimit.remaining.toString(),
          'X-RateLimit-Reset': Math.ceil(emailRateLimit.resetAt / 1000).toString(),
        },
      });
    }

    // Generate submission ID
    const submissionId = generateId();

    // Initialize Slack client
    const slackClient = createSlackClient(
      env.SLACK_BOT_TOKEN,
      env.SLACK_TEAM_ID,
      env.SLACK_LOG_CHANNEL_ID
    );


    // Log initiation
    await slackClient.logToChannel(
      `Channel creation initiated for \`${companyName}\`
- user: \`${email}\`
- sanitized: \`${sanitizedCompanyName}\``,
      'info'
    );

    // 4. Create Slack channel
    const channelResult = await slackClient.createChannel(sanitizedCompanyName);
    if (!channelResult.ok) {
      // Log error and return 502
      await slackClient.logToChannel(
        `Channel creation failed for ${sanitizedCompanyName}: ${channelResult.error} - ${channelResult.details || ''}`,
        'error'
      );
      
      return errorResponse(
        'SLACK_ERROR',
        'Failed to create Slack channel',
        502
      );
    }

    const { channelId, channelName } = channelResult;
    
    // Track errors for partial success scenarios
    let groupInviteError = false;
    let guestInviteError = false;
    let emailSent = true;

    // 5. Invite @guild group
    const groupInviteResult = await slackClient.inviteGroup(channelId);
    if (!groupInviteResult.ok) {
      groupInviteError = true;
      await slackClient.logToChannel(
        `Group invite failed for channel ${channelName} (${channelId}): ${groupInviteResult.error} - ${groupInviteResult.details || ''}`,
        'warn'
      );
    }

    // 6. Invite single-channel guest
    const guestInviteResult = await slackClient.inviteGuest(email, channelId);
    if (!guestInviteResult.ok) {
      guestInviteError = true;
      await slackClient.logToChannel(
        `Guest invite failed for ${email} to channel ${channelName} (${channelId}): ${guestInviteResult.error} - ${guestInviteResult.details || ''}`,
        'warn'
      );
    }

    // 7. Send Postmark email
    const channelUrl = `https://app.slack.com/client/${env.SLACK_TEAM_ID}/${channelId}`;
    const emailResult = await sendWelcomeEmail({
      companyName: validationResult.value.companyName,
      email,
      channelName,
      channelUrl,
    }, env.POSTMARK_API_KEY);

    if (!emailResult.ok) {
      emailSent = false;
      await slackClient.logToChannel(
        `Email sending failed for ${email}: ${emailResult.error}`,
        'warn'
      );
    }

    // 8. Log success (with any partial failures noted)
    const partialFailures = [];
    if (groupInviteError) partialFailures.push('group invite');
    if (guestInviteError) partialFailures.push('guest invite');
    if (!emailSent) partialFailures.push('email');

    const logMessage = partialFailures.length > 0
      ? `Submission processed for ${email} (company: ${validationResult.value.companyName} -> ${sanitizedCompanyName}), channel: ${channelName} (${channelId}). Partial failures: ${partialFailures.join(', ')}`
      : `Submission successfully processed for ${email} (company: ${validationResult.value.companyName} -> ${sanitizedCompanyName}), channel: ${channelName} (${channelId})`;

    await slackClient.logToChannel(logMessage, partialFailures.length > 0 ? 'warn' : 'info');

    // 9. Return success response (include emailSent flag if false)
    const response: FormSubmissionResponse & { slackChannelId: string; emailSent?: boolean } = {
      ok: true,
      id: submissionId,
      sanitizedCompanyName,
      slackChannelId: channelId,
    };

    if (!emailSent) {
      response.emailSent = false;
    }

    return jsonResponse(response, 200, {
      'X-RateLimit-Limit': rateLimit.toString(),
      'X-RateLimit-Remaining-IP': ipRateLimit.remaining.toString(),
      'X-RateLimit-Remaining-Email': emailRateLimit.remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(Math.max(ipRateLimit.resetAt, emailRateLimit.resetAt) / 1000).toString(),
    });

  } catch (error) {
    console.error('Unexpected error in /api/submit:', error);
    
    // Try to log to Slack if we have the environment variables
    try {
      if (env.SLACK_BOT_TOKEN && env.SLACK_LOG_CHANNEL_ID) {
        const slackClient = createSlackClient(
          env.SLACK_BOT_TOKEN,
          env.SLACK_TEAM_ID,
          env.SLACK_LOG_CHANNEL_ID
        );
        await slackClient.logToChannel(
          `Internal server error in /api/submit: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'error'
        );
      }
    } catch (logError) {
      console.error('Failed to log error to Slack:', logError);
    }
    
    return errorResponse(
      'INTERNAL_ERROR',
      'Internal server error',
      500
    );
  }
});

/**
 * Catch-all for API routes that don't exist
 */
router.all('/api/*', (): Response => {
  return errorResponse(
    'NOT_FOUND',
    'API endpoint not found',
    404
  );
});

/**
 * Static file serving - serves the React client app
 */
router.get('*', (request: Request): Response => {
  const url = new URL(request.url);
  let pathname = url.pathname;
  
  // Handle root path
  if (pathname === '/') {
    pathname = '/index.html';
  }
  
  // Remove leading slash for asset lookup
  const assetPath = pathname.slice(1);
  
  // Check if asset exists in the static assets
  // Note: This is a simplified version. In production with many assets,
  // you might want to use a more sophisticated asset manifest system.
  
  // For common static assets, determine content type
  const getContentType = (path: string): string => {
    if (path.endsWith('.html')) return 'text/html';
    if (path.endsWith('.js')) return 'application/javascript';
    if (path.endsWith('.css')) return 'text/css';
    if (path.endsWith('.png')) return 'image/png';
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
    if (path.endsWith('.svg')) return 'image/svg+xml';
    if (path.endsWith('.ico')) return 'image/x-icon';
    return 'application/octet-stream';
  };
  
  // Try to get the asset from the static folder
  // In Cloudflare Workers with site assets, this would use the built-in asset serving
  // For now, serve a fallback HTML that shows the API is working
  if (pathname === '/index.html' || pathname === '/') {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Conference Slack Form</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
        .status { color: green; font-weight: bold; }
        .endpoint { background: #f5f5f5; padding: 10px; margin: 5px 0; border-radius: 4px; }
        .note { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>Conference Slack Form</h1>
    <p class="status">✅ Worker is running successfully!</p>
    
    <div class="note">
        <strong>Note:</strong> This is a placeholder page. In production, the React client app will be served here.
        Run the deployment script to build and serve the full client application.
    </div>
    
    <h2>Available API Endpoints:</h2>
    <div class="endpoint">
        <strong>GET /api/ping</strong> - Health check
        <br><a href="/api/ping" target="_blank">Test this endpoint</a>
    </div>
    <div class="endpoint">
        <strong>POST /api/sanitize-preview</strong> - Preview company name sanitization
    </div>
    <div class="endpoint">
        <strong>POST /api/submit</strong> - Submit form data
    </div>
    
    <h2>Deployment Instructions:</h2>
    <ol>
        <li>Run <code>./scripts/deploy.sh</code> to build and prepare for deployment</li>
        <li>Set environment variables in Cloudflare dashboard</li>
        <li>Run <code>./scripts/deploy.sh --deploy</code> to deploy to production</li>
        <li>Test with <code>./scripts/smoke-test.sh [WORKER_URL]</code></li>
    </ol>
</body>
</html>
    `.trim();
    
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=300', // 5 minutes cache
      },
    });
  }
  
  // For other paths that might be client-side routes, serve index.html (SPA behavior)
  if (!assetPath.includes('.') && pathname !== '/api' && !pathname.startsWith('/api/')) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Conference Slack Form</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
        .status { color: green; font-weight: bold; }
        .endpoint { background: #f5f5f5; padding: 10px; margin: 5px 0; border-radius: 4px; }
        .note { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>Conference Slack Form</h1>
    <p class="status">✅ Worker is running successfully!</p>
    
    <div class="note">
        <strong>Note:</strong> This is a placeholder page. In production, the React client app will be served here.
        Run the deployment script to build and serve the full client application.
    </div>
    
    <h2>Available API Endpoints:</h2>
    <div class="endpoint">
        <strong>GET /api/ping</strong> - Health check
        <br><a href="/api/ping" target="_blank">Test this endpoint</a>
    </div>
    <div class="endpoint">
        <strong>POST /api/sanitize-preview</strong> - Preview company name sanitization
    </div>
    <div class="endpoint">
        <strong>POST /api/submit</strong> - Submit form data
    </div>
    
    <h2>Deployment Instructions:</h2>
    <ol>
        <li>Run <code>./scripts/deploy.sh</code> to build and prepare for deployment</li>
        <li>Set environment variables in Cloudflare dashboard</li>
        <li>Run <code>./scripts/deploy.sh --deploy</code> to deploy to production</li>
        <li>Test with <code>./scripts/smoke-test.sh [WORKER_URL]</code></li>
    </ol>
</body>
</html>
    `.trim();
    
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  }
  
  return errorResponse(
    'NOT_FOUND',
    'File not found',
    404
  );
});

/**
 * Main worker export
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await router.fetch(request, env);
    } catch (error) {
      console.error('Router error:', error);
      return errorResponse(
        'INTERNAL_ERROR',
        'Internal server error',
        500
      );
    }
  },
};
