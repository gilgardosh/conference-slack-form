/**
 * Integration example for email service with Slack
 * This demonstrates how to use the email service in conjunction with Slack operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendWelcomeEmail, type WelcomeEmailParams } from './email';
import { createSlackClient } from './slack';

describe('Email and Slack Integration', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn() as any;
  });

  it('should demonstrate complete workflow: create channel and send welcome email', async () => {
    // Mock Slack channel creation success
    const slackChannelResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        ok: true,
        channel: {
          id: 'C1234567890',
          name: 'ext-theguild-test-company',
        },
      }),
    };

    // Mock Postmark email success
    const postmarkResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        MessageID: 'b7bc2f4a-e38e-4336-af7d-e6c392c2f817',
        To: 'test@example.com',
        SubmittedAt: '2025-08-14T12:00:00.000Z',
      }),
    };

    // Mock fetch to return different responses based on URL
    mockFetch
      .mockResolvedValueOnce(slackChannelResponse) // Slack API call
      .mockResolvedValueOnce(postmarkResponse); // Postmark API call

    // Create Slack client
    const slackClient = createSlackClient(
      'test-slack-token',
      'test-team-id',
      'test-log-channel',
      mockFetch as any
    );

    // Step 1: Create Slack channel
    const channelResult = await slackClient.createChannel('test-company');

    expect(channelResult).toEqual({
      ok: true,
      channelId: 'C1234567890',
      channelName: 'ext-theguild-test-company',
    });

    // Step 2: Send welcome email with channel information
    if (channelResult.ok) {
      const emailParams: WelcomeEmailParams = {
        companyName: 'Test Company',
        email: 'test@example.com',
        channelName: channelResult.channelName,
        channelUrl: `https://theguild.slack.com/channels/${channelResult.channelId}`,
      };

      const emailResult = await sendWelcomeEmail(
        emailParams,
        'test-postmark-key',
        mockFetch as any
      );

      expect(emailResult).toEqual({ ok: true });
    }

    // Verify both API calls were made
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Verify Slack API call
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://slack.com/api/conversations.create',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-slack-token',
        }),
      })
    );

    // Verify Postmark API call
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://api.postmarkapp.com/email',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Postmark-Server-Token': 'test-postmark-key',
        }),
      })
    );
  });

  it('should handle email failure and log to Slack', async () => {
    // Mock Slack logging success
    const slackLogResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        ok: true,
        ts: '1692019200.123456',
      }),
    };

    // Mock Postmark failure
    const postmarkErrorResponse = {
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: vi.fn().mockResolvedValue({
        ErrorCode: 300,
        Message: 'Invalid email address',
      }),
      text: vi
        .fn()
        .mockResolvedValue(
          '{"ErrorCode":300,"Message":"Invalid email address"}'
        ),
    };

    mockFetch
      .mockResolvedValueOnce(postmarkErrorResponse) // Postmark fails
      .mockResolvedValueOnce(slackLogResponse); // Slack logging succeeds

    // Try to send email
    const emailParams: WelcomeEmailParams = {
      companyName: 'Test Company',
      email: 'invalid-email@domain.com',
      channelName: 'ext-theguild-test-company',
      channelUrl: 'https://theguild.slack.com/channels/C1234567890',
    };

    const emailResult = await sendWelcomeEmail(
      emailParams,
      'test-postmark-key',
      mockFetch as any
    );

    expect(emailResult.ok).toBe(false);
    if (!emailResult.ok) {
      expect(emailResult.error).toContain('Postmark API error');

      // Now log the error to Slack
      const slackClient = createSlackClient(
        'test-slack-token',
        'test-team-id',
        'test-log-channel',
        mockFetch as any
      );

      const logResult = await slackClient.logToChannel(
        `Email sending failed for company "Test Company": ${emailResult.error}`,
        'error'
      );

      expect(logResult).toEqual({
        ok: true,
        timestamp: '1692019200.123456',
      });
    }

    // Verify both API calls were made
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should demonstrate PII-safe logging', () => {
    // This demonstrates how to safely log email addresses
    function sanitizeEmailForLogging(email: string): string {
      const [localPart, domain] = email.split('@');
      if (!domain || !localPart) return '[invalid-email]';

      const prefix =
        localPart.length >= 2 ? localPart.substring(0, 2) : localPart;
      return `${prefix}***@${domain}`;
    }

    // Test email sanitization
    expect(sanitizeEmailForLogging('john.doe@example.com')).toBe(
      'jo***@example.com'
    );
    expect(sanitizeEmailForLogging('a@test.com')).toBe('a***@test.com');
    expect(sanitizeEmailForLogging('invalid-email')).toBe('[invalid-email]');

    // Example log message with sanitized email
    const email = 'user@company.com';
    const sanitizedEmail = sanitizeEmailForLogging(email);
    const logMessage = `Welcome email sent to ${sanitizedEmail} for channel #ext-theguild-company`;

    expect(logMessage).toBe(
      'Welcome email sent to us***@company.com for channel #ext-theguild-company'
    );
    expect(logMessage).not.toContain('user@company.com'); // Original email not in logs
  });
});
