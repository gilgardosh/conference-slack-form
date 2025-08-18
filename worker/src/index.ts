import { Router } from 'itty-router';
import type { Env, FormSubmissionResponse, PingResponse } from './types';
import { generateId, jsonResponse, errorResponse } from './utils';
import {
  validateAndSanitize,
  validateAndSanitizePreview,
} from './utils/validation';
import { checkIpRateLimit, checkEmailRateLimit } from './lib/rateLimiter';
import { createSlackClient } from './lib/slack';
// import { sendWelcomeEmail } from './lib/email';

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
router.post(
  '/api/sanitize-preview',
  async (request: Request): Promise<Response> => {
    try {
      // Parse request body
      let body: unknown;

      try {
        body = await request.json();
      } catch {
        return errorResponse(
          'INVALID_JSON',
          'Invalid JSON in request body',
          400
        );
      }

      // Validate and sanitize input (without rate limit increment)
      const validationResult = validateAndSanitizePreview(body);

      if (!validationResult.ok) {
        return new Response(
          JSON.stringify({
            ok: false,
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            errors: validationResult.errors,
          }),
          {
            status: 422,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }

      const { sanitizedCompanyName } = validationResult.value;

      return jsonResponse({
        ok: true,
        sanitizedCompanyName,
      });
    } catch (error) {
      console.error('Unexpected error in /api/sanitize-preview:', error);

      return errorResponse('INTERNAL_ERROR', 'Internal server error', 500);
    }
  }
);

/**
 * Form submission endpoint
 * POST /api/submit
 */
router.post(
  '/api/submit',
  async (request: Request, env: Env): Promise<Response> => {
    try {
      // Get client IP address
      const clientIP =
        request.headers.get('CF-Connecting-IP') ||
        request.headers.get('X-Forwarded-For') ||
        'unknown';

      // Get rate limit settings from environment with defaults
      const rateLimit = parseInt(env.RATE_LIMIT || '10', 10);
      const rateLimitWindowSec = parseInt(
        env.RATE_LIMIT_WINDOW_SEC || '3600',
        10
      ); // 1 hour default

      // 1. Check IP rate limit FIRST (before parsing JSON)
      const ipRateLimit = checkIpRateLimit(
        clientIP,
        rateLimit,
        rateLimitWindowSec
      );
      if (!ipRateLimit.allowed) {
        return new Response(
          JSON.stringify({
            ok: false,
            errorCode: 'rate_limit',
            message: 'Rate limit exceeded',
            metadata: {
              type: 'ip',
              remaining: ipRateLimit.remaining,
            },
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'X-RateLimit-Limit': rateLimit.toString(),
              'X-RateLimit-Remaining': ipRateLimit.remaining.toString(),
              'X-RateLimit-Reset': Math.ceil(
                ipRateLimit.resetAt / 1000
              ).toString(),
            },
          }
        );
      }

      // 2. Parse request body
      let body: unknown;

      try {
        body = await request.json();
      } catch {
        return errorResponse(
          'INVALID_JSON',
          'Invalid JSON in request body',
          400
        );
      }

      // 3. Validate and sanitize input
      const validationResult = validateAndSanitize(body);

      if (!validationResult.ok) {
        return new Response(
          JSON.stringify({
            ok: false,
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            errors: validationResult.errors,
          }),
          {
            status: 422,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }

      const { email, sanitizedCompanyName, companyName } =
        validationResult.value;

      // 4. Check email rate limit
      const emailRateLimit = checkEmailRateLimit(
        email,
        rateLimit,
        rateLimitWindowSec
      );
      if (!emailRateLimit.allowed) {
        return new Response(
          JSON.stringify({
            ok: false,
            errorCode: 'rate_limit',
            message: 'Rate limit exceeded',
            metadata: {
              type: 'email',
              remaining: emailRateLimit.remaining,
            },
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'X-RateLimit-Limit': rateLimit.toString(),
              'X-RateLimit-Remaining': emailRateLimit.remaining.toString(),
              'X-RateLimit-Reset': Math.ceil(
                emailRateLimit.resetAt / 1000
              ).toString(),
            },
          }
        );
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

      // 5. Create Slack channel
      const channelResult =
        await slackClient.createChannel(sanitizedCompanyName);
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
      // let emailSent = true;

      // 6. Get team users
      const teamUsersResult = await slackClient.getGroupUsers();
      if (!teamUsersResult.ok) {
        // Log error and return 502
        await slackClient.logToChannel(
          `Team users fetch failed for ${env.SLACK_TEAM_ID}: ${teamUsersResult.error} - ${teamUsersResult.details || ''}`,
          'error'
        );

        return errorResponse('SLACK_ERROR', 'Failed to invite team users', 502);
      }

      // 7. Invite @guild group
      const groupInviteResult = await slackClient.inviteGroup(
        channelId,
        teamUsersResult.users
      );
      if (!groupInviteResult.ok) {
        groupInviteError = true;
        await slackClient.logToChannel(
          `Group invite failed for channel #${channelName} (${channelId}): ${groupInviteResult.error} - ${groupInviteResult.details || ''}`,
          'warn'
        );
      }

      // 8. Invite single-channel guest
      const guestInviteResult = await slackClient.inviteGuest(email, channelId);
      if (!guestInviteResult.ok) {
        guestInviteError = true;
        await slackClient.logToChannel(
          `Guest invite failed for ${email} to channel #${channelName} (${channelId}): ${guestInviteResult.error} - ${guestInviteResult.details || ''}`,
          'warn'
        );
      }

      // 9. Send Postmark email
      // const channelUrl = `https://app.slack.com/client/${env.SLACK_TEAM_ID}/${channelId}`;
      // const emailResult = await sendWelcomeEmail({
      //   companyName: validationResult.value.companyName,
      //   email,
      //   channelName,
      //   channelUrl,
      // }, env.POSTMARK_API_KEY);

      // if (!emailResult.ok) {
      //   emailSent = false;
      //   await slackClient.logToChannel(
      //     `Email sending failed for ${email}: ${emailResult.error}`,
      //     'warn'
      //   );
      // }

      // 10. Log success (with any partial failures noted)
      const partialFailures = [];
      if (groupInviteError) partialFailures.push('group invite');
      if (guestInviteError) partialFailures.push('guest invite');
      // if (!emailSent) partialFailures.push('email');

      const logMessage =
        partialFailures.length > 0
          ? `Submission processed for ${email} (company: ${validationResult.value.companyName} -> ${sanitizedCompanyName}), channel: #${channelName} (${channelId}). Partial failures: ${partialFailures.join(', ')}`
          : `Submission successfully processed for ${email} (company: ${validationResult.value.companyName} -> ${sanitizedCompanyName}), channel: #${channelName} (${channelId})`;

      await slackClient.logToChannel(
        logMessage,
        partialFailures.length > 0 ? 'warn' : 'info'
      );

      // 11. Return success response (include emailSent flag if false)
      const response: FormSubmissionResponse & {
        slackChannelId: string;
        emailSent?: boolean;
      } = {
        ok: true,
        id: submissionId,
        sanitizedCompanyName,
        slackChannelId: channelId,
      };

      // if (!emailSent) {
      //   response.emailSent = false;
      // }

      return jsonResponse(response, 200, {
        'X-RateLimit-Limit': rateLimit.toString(),
        'X-RateLimit-Remaining-IP': ipRateLimit.remaining.toString(),
        'X-RateLimit-Remaining-Email': emailRateLimit.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(
          Math.max(ipRateLimit.resetAt, emailRateLimit.resetAt) / 1000
        ).toString(),
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

      return errorResponse('INTERNAL_ERROR', 'Internal server error', 500);
    }
  }
);

/**
 * Catch-all for API routes that don't exist
 */
router.all('/api/*', (): Response => {
  return errorResponse('NOT_FOUND', 'API endpoint not found', 404);
});

/**
 * Static file serving - serves the React client app
 */
router.get('*', (request: Request, env: Env) => {
  // Use the ASSETS binding to serve static files
  return env.ASSETS.fetch(request);
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
      return errorResponse('INTERNAL_ERROR', 'Internal server error', 500);
    }
  },
};
