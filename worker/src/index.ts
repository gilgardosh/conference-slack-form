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
 * Form submission endpoint
 * POST /api/submit
 */
router.post('/api/submit', async (request: Request, env: Env): Promise<Response> => {
  try {
    // Get client IP address
    const clientIP = request.headers.get('CF-Connecting-IP') || 
                     request.headers.get('X-Forwarded-For') || 
                     'unknown';

    // Get rate limit settings from environment with defaults
    const rateLimit = parseInt(env.RATE_LIMIT || '10', 10);
    const rateLimitWindowSec = parseInt(env.RATE_LIMIT_WINDOW_SEC || '3600', 10); // 1 hour default

    // Check IP rate limit first
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

    // Validate and sanitize input
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

    // Check email rate limit after validation
    const emailRateLimit = checkEmailRateLimit(validationResult.value.email, rateLimit, rateLimitWindowSec);
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

    // Generate response with validated and sanitized data
    const submissionId = generateId();

    const response: FormSubmissionResponse = {
      ok: true,
      id: submissionId,
      sanitizedCompanyName: validationResult.value.sanitizedCompanyName,
    };

    return jsonResponse(response, 200, {
      'X-RateLimit-Limit': rateLimit.toString(),
      'X-RateLimit-Remaining-IP': ipRateLimit.remaining.toString(),
      'X-RateLimit-Remaining-Email': emailRateLimit.remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(Math.max(ipRateLimit.resetAt, emailRateLimit.resetAt) / 1000).toString(),
    });

  } catch (error) {
    console.error('Unexpected error in /api/submit:', error);
    
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
 * Static file serving (placeholder for production builds)
 */
router.get('*', (request: Request): Response => {
  const url = new URL(request.url);
  
  // In production, this would serve static files from the client build
  // For now, return a simple HTML page
  if (url.pathname === '/' || url.pathname === '/index.html') {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Conference Slack Form</title>
</head>
<body>
    <div id="root">
        <h1>Conference Slack Form</h1>
        <p>Worker is running. Client app will be served here in production.</p>
        <p>API endpoints:</p>
        <ul>
            <li><a href="/api/ping">GET /api/ping</a></li>
            <li>POST /api/submit</li>
        </ul>
    </div>
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
