/**
 * Example integration of email service with the main worker
 * This shows how to integrate the email functionality into the existing form submission endpoint
 */

import type { Env, FormSubmissionRequest } from '../types';
import { validateAndSanitize } from '../utils/validation';
import { createSlackClient } from './slack';
import { sendWelcomeEmail } from './email';
import { generateId } from '../utils';

/**
 * Enhanced form submission handler with email functionality
 */
export async function handleFormSubmissionWithEmail(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    // Parse and validate request
    const body = await request.json() as FormSubmissionRequest;
    const validationResult = validateAndSanitize(body);
    
    if (!validationResult.ok) {
      return new Response(JSON.stringify({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        errors: validationResult.errors
      }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { companyName, sanitizedCompanyName, email } = validationResult.value;

    // Initialize Slack client
    const slackClient = createSlackClient(
      env.SLACK_BOT_TOKEN,
      env.SLACK_TEAM_ID,
      env.SLACK_LOG_CHANNEL_ID
    );

    // Step 1: Create Slack channel
    const channelResult = await slackClient.createChannel(sanitizedCompanyName);
    
    if (!channelResult.ok) {
      // Log channel creation failure
      await slackClient.logToChannel(
        `Failed to create channel for "${companyName}": ${channelResult.error}`,
        'error'
      );
      
      return new Response(JSON.stringify({
        ok: false,
        code: 'CHANNEL_CREATION_FAILED',
        message: 'Failed to create Slack channel'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Invite guild team to channel
    const inviteResult = await slackClient.inviteGroup(channelResult.channelId);
    
    if (!inviteResult.ok) {
      // Log invitation failure but continue with email
      await slackClient.logToChannel(
        `Failed to invite guild team to channel #${channelResult.channelName}: ${inviteResult.error}`,
        'warn'
      );
    }

    // Step 3: Send welcome email
    const emailResult = await sendWelcomeEmail({
      companyName: companyName,
      email: email,
      channelName: channelResult.channelName,
      channelUrl: `https://theguild.slack.com/channels/${channelResult.channelId}`
    }, env.POSTMARK_API_KEY);

    if (!emailResult.ok) {
      // Log email failure to Slack
      await slackClient.logToChannel(
        `Email sending failed for company "${companyName}" (${sanitizeEmailForLogging(email)}): ${emailResult.error}`,
        'error'
      );
      
      // Email failure is not fatal - we still created the channel
      await slackClient.logToChannel(
        `Channel #${channelResult.channelName} created for "${companyName}" but welcome email failed`,
        'warn'
      );
    } else {
      // Log successful completion
      await slackClient.logToChannel(
        `Successfully created channel #${channelResult.channelName} and sent welcome email to ${sanitizeEmailForLogging(email)} for "${companyName}"`,
        'info'
      );
    }

    // Step 4: Invite user as guest (optional, may require admin permissions)
    const guestInviteResult = await slackClient.inviteGuest(email, channelResult.channelId);
    
    if (!guestInviteResult.ok) {
      // Log guest invitation failure
      await slackClient.logToChannel(
        `Failed to send guest invite to ${sanitizeEmailForLogging(email)} for channel #${channelResult.channelName}: ${guestInviteResult.error}`,
        'warn'
      );
    }

    // Return success response
    const submissionId = generateId();
    
    return new Response(JSON.stringify({
      ok: true,
      id: submissionId,
      sanitizedCompanyName: sanitizedCompanyName,
      channelName: channelResult.channelName,
      channelId: channelResult.channelId,
      emailSent: emailResult.ok,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unexpected error in form submission:', error);
    
    return new Response(JSON.stringify({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Sanitize email for logging (prevent PII leaks)
 */
function sanitizeEmailForLogging(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!domain || !localPart) return '[invalid-email]';
  
  const prefix = localPart.length >= 2 ? localPart.substring(0, 2) : localPart;
  return `${prefix}***@${domain}`;
}

/**
 * Usage example in the main router:
 * 
 * ```typescript
 * router.post('/api/submit', async (request: Request, env: Env): Promise<Response> => {
 *   return handleFormSubmissionWithEmail(request, env);
 * });
 * ```
 */
