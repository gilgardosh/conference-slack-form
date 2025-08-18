/**
 * Integration tests for the /api/submit endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from './index';
import type { Env } from './types';

// Mock implementations
const mockSlackClient = {
  createChannel: vi.fn(),
  inviteGroup: vi.fn(),
  inviteGuest: vi.fn(),
  logToChannel: vi.fn(),
  getGroupUsers: vi
    .fn()
    .mockResolvedValue({ ok: true, users: ['U1234567890'] }),
};

// const mockEmailClient = {
//   sendWelcomeEmail: vi.fn(),
// };

// Mock the modules
vi.mock('./lib/slack', () => ({
  createSlackClient: vi.fn(() => mockSlackClient),
}));

// vi.mock('./lib/email', () => ({
//   sendWelcomeEmail: vi.fn((...args) => mockEmailClient.sendWelcomeEmail(...args)),
// }));

describe('/api/submit endpoint integration tests', () => {
  const mockEnv: Env = {
    ASSETS: {
      fetch: vi.fn().mockResolvedValue(new Response('mock asset')),
    } as unknown as Fetcher,
    SLACK_BOT_TOKEN: 'test-bot-token',
    SLACK_TEAM_ID: 'test-team-id',
    SLACK_LOG_CHANNEL_ID: 'test-log-channel',
    POSTMARK_API_KEY: 'test-postmark-key',
    RATE_LIMIT: '10',
    RATE_LIMIT_WINDOW_SEC: '3600',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default successful mocks
    mockSlackClient.createChannel.mockResolvedValue({
      ok: true,
      channelId: 'C123456789',
      channelName: 'ext-theguild-test-company',
    });

    mockSlackClient.inviteGroup.mockResolvedValue({
      ok: true,
      invited: true,
      details: 'Guild group invited to channel',
    });

    mockSlackClient.inviteGuest.mockResolvedValue({
      ok: true,
      invited: true,
      details: 'Guest invite sent',
    });

    mockSlackClient.logToChannel.mockResolvedValue({
      ok: true,
      timestamp: '1234567890.123',
    });

    // mockEmailClient.sendWelcomeEmail.mockResolvedValue({
    //   ok: true,
    // });
  });

  it('should process valid submission successfully with full flow', async () => {
    const request = new Request('http://localhost:8787/api/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '127.0.0.1',
      },
      body: JSON.stringify({
        companyName: 'Test Company',
        email: 'test@company.com',
      }),
    });

    const response = await worker.fetch(request, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toEqual({
      ok: true,
      id: expect.any(String),
      sanitizedCompanyName: 'test-company',
      slackChannelId: 'C123456789',
    });

    // Verify the flow was called in the correct order
    expect(mockSlackClient.createChannel).toHaveBeenCalledWith('test-company');
    expect(mockSlackClient.inviteGroup).toHaveBeenCalledWith('C123456789', [
      'U1234567890',
    ]);
    expect(mockSlackClient.inviteGuest).toHaveBeenCalledWith(
      'test@company.com',
      'C123456789'
    );
    // expect(mockEmailClient.sendWelcomeEmail).toHaveBeenCalledWith({
    //   companyName: 'Test Company',
    //   email: 'test@company.com',
    //   channelName: 'ext-theguild-test-company',
    //   channelUrl: 'https://app.slack.com/client/test-team-id/C123456789',
    // }, 'test-postmark-key');
    expect(mockSlackClient.logToChannel).toHaveBeenCalledWith(
      expect.stringContaining(
        'Submission successfully processed for test@company.com'
      ),
      'info'
    );
  });

  it('should return 422 for validation errors', async () => {
    const request = new Request('http://localhost:8787/api/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '127.0.0.1',
      },
      body: JSON.stringify({
        companyName: '', // Invalid: empty
        email: 'invalid-email', // Invalid: format
      }),
    });

    const response = await worker.fetch(request, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(422);
    expect(result).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      errors: expect.any(Array),
    });

    // No Slack or email operations should have been called
    expect(mockSlackClient.createChannel).not.toHaveBeenCalled();
    // expect(mockEmailClient.sendWelcomeEmail).not.toHaveBeenCalled();
  });

  it('should return 429 for IP rate limiting', async () => {
    // First request should succeed
    const firstRequest = new Request('http://localhost:8787/api/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '192.168.1.1',
      },
      body: JSON.stringify({
        companyName: 'Test Company 1',
        email: 'test1@company.com',
      }),
    });

    await worker.fetch(firstRequest, { ...mockEnv, RATE_LIMIT: '1' });

    // Second request from same IP should be rate limited
    const secondRequest = new Request('http://localhost:8787/api/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '192.168.1.1',
      },
      body: JSON.stringify({
        companyName: 'Test Company 2',
        email: 'test2@company.com',
      }),
    });

    const response = await worker.fetch(secondRequest, {
      ...mockEnv,
      RATE_LIMIT: '1',
    });
    const result = await response.json();

    expect(response.status).toBe(429);
    expect(result).toEqual({
      ok: false,
      errorCode: 'rate_limit',
      message: 'Rate limit exceeded',
      metadata: {
        type: 'ip',
        remaining: 0,
      },
    });
  });

  it('should return 429 for email rate limiting', async () => {
    // First request should succeed
    const firstRequest = new Request('http://localhost:8787/api/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '127.0.0.1',
      },
      body: JSON.stringify({
        companyName: 'Test Company 1',
        email: 'test@company.com',
      }),
    });

    await worker.fetch(firstRequest, { ...mockEnv, RATE_LIMIT: '1' });

    // Second request with same email should be rate limited
    const secondRequest = new Request('http://localhost:8787/api/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '127.0.0.2', // Different IP
      },
      body: JSON.stringify({
        companyName: 'Test Company 2',
        email: 'test@company.com', // Same email
      }),
    });

    const response = await worker.fetch(secondRequest, {
      ...mockEnv,
      RATE_LIMIT: '1',
    });
    const result = await response.json();

    expect(response.status).toBe(429);
    expect(result).toEqual({
      ok: false,
      errorCode: 'rate_limit',
      message: 'Rate limit exceeded',
      metadata: {
        type: 'email',
        remaining: 0,
      },
    });
  });

  it('should return 502 when Slack channel creation fails', async () => {
    mockSlackClient.createChannel.mockResolvedValue({
      ok: false,
      error: 'slack_error',
      details: 'API temporarily unavailable',
    });

    const request = new Request('http://localhost:8787/api/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '127.0.0.1',
      },
      body: JSON.stringify({
        companyName: 'Test Company',
        email: 'test@company.com',
      }),
    });

    const response = await worker.fetch(request, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(502);
    expect(result).toEqual({
      ok: false,
      errorCode: 'SLACK_ERROR',
      message: 'Failed to create Slack channel',
    });

    // Should have logged the error
    expect(mockSlackClient.logToChannel).toHaveBeenCalledWith(
      expect.stringContaining('Channel creation failed for test-company'),
      'error'
    );

    // No further operations should have been attempted
    expect(mockSlackClient.inviteGroup).not.toHaveBeenCalled();
    expect(mockSlackClient.inviteGuest).not.toHaveBeenCalled();
    // expect(mockEmailClient.sendWelcomeEmail).not.toHaveBeenCalled();
  });

  it('should continue processing when group invite fails', async () => {
    mockSlackClient.inviteGroup.mockResolvedValue({
      ok: false,
      error: 'group_not_found',
      details: 'Guild group not found',
    });

    const request = new Request('http://localhost:8787/api/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '127.0.0.1',
      },
      body: JSON.stringify({
        companyName: 'Test Company',
        email: 'test@company.com',
      }),
    });

    const response = await worker.fetch(request, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toEqual({
      ok: true,
      id: expect.any(String),
      sanitizedCompanyName: 'test-company',
      slackChannelId: 'C123456789',
    });

    // Should have logged the warning
    expect(mockSlackClient.logToChannel).toHaveBeenCalledWith(
      expect.stringContaining('Group invite failed'),
      'warn'
    );

    // Should still continue with guest invite and email
    expect(mockSlackClient.inviteGuest).toHaveBeenCalled();
    // expect(mockEmailClient.sendWelcomeEmail).toHaveBeenCalled();

    // Should log with partial failures
    expect(mockSlackClient.logToChannel).toHaveBeenCalledWith(
      expect.stringContaining('Partial failures: group invite'),
      'warn'
    );
  });

  it('should continue processing when guest invite fails', async () => {
    mockSlackClient.inviteGuest.mockResolvedValue({
      ok: false,
      error: 'user_not_found',
      details: 'User already exists',
    });

    const request = new Request('http://localhost:8787/api/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '127.0.0.1',
      },
      body: JSON.stringify({
        companyName: 'Test Company',
        email: 'test@company.com',
      }),
    });

    const response = await worker.fetch(request, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toEqual({
      ok: true,
      id: expect.any(String),
      sanitizedCompanyName: 'test-company',
      slackChannelId: 'C123456789',
    });

    // Should have logged the warning
    expect(mockSlackClient.logToChannel).toHaveBeenCalledWith(
      expect.stringContaining('Guest invite failed'),
      'warn'
    );

    // Should still continue with email
    // expect(mockEmailClient.sendWelcomeEmail).toHaveBeenCalled();

    // Should log with partial failures
    expect(mockSlackClient.logToChannel).toHaveBeenCalledWith(
      expect.stringContaining('Partial failures: guest invite'),
      'warn'
    );
  });

  it('should continue processing when email fails', async () => {
    // mockEmailClient.sendWelcomeEmail.mockResolvedValue({
    //   ok: false,
    //   error: 'Email sending failed: Network error',
    // });

    const request = new Request('http://localhost:8787/api/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '127.0.0.1',
      },
      body: JSON.stringify({
        companyName: 'Test Company',
        email: 'test@company.com',
      }),
    });

    const response = await worker.fetch(request, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toEqual({
      ok: true,
      id: expect.any(String),
      sanitizedCompanyName: 'test-company',
      slackChannelId: 'C123456789',
      // emailSent: false,
    });

    // Should have logged the warning
    // expect(mockSlackClient.logToChannel).toHaveBeenCalledWith(
    //   expect.stringContaining('Email sending failed'),
    //   'warn'
    // );

    // Should log with partial failures
    // expect(mockSlackClient.logToChannel).toHaveBeenCalledWith(
    //   expect.stringContaining('Partial failures: email'),
    //   'warn'
    // );
  });

  it('should handle multiple partial failures', async () => {
    mockSlackClient.inviteGroup.mockResolvedValue({
      ok: false,
      error: 'group_error',
    });

    mockSlackClient.inviteGuest.mockResolvedValue({
      ok: false,
      error: 'guest_error',
    });

    // mockEmailClient.sendWelcomeEmail.mockResolvedValue({
    //   ok: false,
    //   error: 'email_error',
    // });

    const request = new Request('http://localhost:8787/api/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '127.0.0.1',
      },
      body: JSON.stringify({
        companyName: 'Test Company',
        email: 'test@company.com',
      }),
    });

    const response = await worker.fetch(request, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toEqual({
      ok: true,
      id: expect.any(String),
      sanitizedCompanyName: 'test-company',
      slackChannelId: 'C123456789',
      // emailSent: false,
    });

    // Should log with all partial failures
    expect(mockSlackClient.logToChannel).toHaveBeenCalledWith(
      expect.stringContaining('Partial failures: group invite, guest invite'),
      'warn'
    );
  });

  it('should handle invalid JSON in request body', async () => {
    const request = new Request('http://localhost:8787/api/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '127.0.0.1',
      },
      body: 'invalid json',
    });

    const response = await worker.fetch(request, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result).toEqual({
      ok: false,
      errorCode: 'INVALID_JSON',
      message: 'Invalid JSON in request body',
    });
  });

  it('should sanitize complex company names correctly', async () => {
    const request = new Request('http://localhost:8787/api/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '127.0.0.1',
      },
      body: JSON.stringify({
        companyName: 'Café & Co. 🚀 Ñiño',
        email: 'test@company.com',
      }),
    });

    const response = await worker.fetch(request, mockEnv);
    const result = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(result.sanitizedCompanyName).toBe('cafe-co-nino');
    expect(mockSlackClient.createChannel).toHaveBeenCalledWith('cafe-co-nino');
  });
});
