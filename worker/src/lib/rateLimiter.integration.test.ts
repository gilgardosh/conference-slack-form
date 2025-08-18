import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '../index';
import { getRateLimiter } from '../lib/rateLimiter';
import { Env } from '../types';

// Mock Slack and Email services
vi.mock('../lib/slack', () => ({
  createSlackClient: vi.fn(() => ({
    logToChannel: vi
      .fn()
      .mockResolvedValue({ ok: true, timestamp: '1234567890.123456' }),
    createChannel: vi.fn().mockResolvedValue({
      ok: true,
      channelId: 'C1234567890',
      channelName: 'test-company',
    }),
    inviteGroup: vi.fn().mockResolvedValue({ ok: true, invited: true }),
    inviteGuest: vi.fn().mockResolvedValue({ ok: true, invited: true }),
  })),
}));

vi.mock('../lib/email', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue({ ok: true }),
}));

// Mock environment for testing
const mockEnv: Env = {
  ASSETS: {
    fetch: vi.fn(async () => new Response('')), // Mock Fetcher
  } as unknown as Fetcher,
  SLACK_BOT_TOKEN: 'test-token',
  SLACK_TEAM_ID: 'test-team',
  SLACK_LOG_CHANNEL_ID: 'test-channel',
  POSTMARK_API_KEY: 'test-key',
  RATE_LIMIT: '3',
  RATE_LIMIT_WINDOW_SEC: '60',
};

// Helper function to create a request with specific IP
function createRequest(body: unknown, ip = '127.0.0.1'): Request {
  return new Request('http://localhost:8787/api/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': ip,
    },
    body: JSON.stringify(body),
  });
}

// Valid form data for testing
const validFormData = {
  companyName: 'Test Company',
  email: 'test@example.com',
};

describe('Rate Limiter Integration', () => {
  beforeEach(() => {
    // Clear rate limiter before each test
    getRateLimiter().clear();
    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('IP-based rate limiting', () => {
    it('should allow requests within IP limit', async () => {
      const ip = '192.168.1.1';

      // Make 3 requests (limit is 3)
      for (let i = 0; i < 3; i++) {
        const request = createRequest(validFormData, ip);
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(200);

        const data = (await response.json()) as any;
        expect(data.ok).toBe(true);
        expect(data.id).toBeDefined();

        // Check rate limit headers
        expect(response.headers.get('X-RateLimit-Limit')).toBe('3');
        expect(response.headers.get('X-RateLimit-Remaining-IP')).toBe(
          (2 - i).toString()
        );
      }
    });

    it('should block requests after IP limit is exceeded', async () => {
      const ip = '192.168.1.2';

      // Exhaust the limit
      for (let i = 0; i < 3; i++) {
        const request = createRequest(validFormData, ip);
        await worker.fetch(request, mockEnv);
      }

      // Next request should be rate limited
      const blockedRequest = createRequest(validFormData, ip);
      const response = await worker.fetch(blockedRequest, mockEnv);

      expect(response.status).toBe(429);

      const data = (await response.json()) as any;
      expect(data.ok).toBe(false);
      expect(data.errorCode).toBe('rate_limit');
      expect(data.message).toBe('Rate limit exceeded');
      expect(data.metadata.type).toBe('ip');
      expect(data.metadata.remaining).toBe(0);

      // Check rate limit headers
      expect(response.headers.get('X-RateLimit-Limit')).toBe('3');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(response.headers.get('X-RateLimit-Reset')).toBeDefined();
    });

    it('should handle different IPs independently', async () => {
      const ip1 = '192.168.1.10';
      const ip2 = '192.168.1.11';

      // Exhaust limit for IP1
      for (let i = 0; i < 3; i++) {
        const request = createRequest(
          { ...validFormData, email: `user${i}@example.com` },
          ip1
        );
        await worker.fetch(request, mockEnv);
      }

      // IP1 should be blocked
      const blockedRequest = createRequest(
        { ...validFormData, email: 'blocked@example.com' },
        ip1
      );
      const blockedResponse = await worker.fetch(blockedRequest, mockEnv);
      expect(blockedResponse.status).toBe(429);

      // IP2 should still be allowed
      const allowedRequest = createRequest(
        { ...validFormData, email: 'allowed@example.com' },
        ip2
      );
      const allowedResponse = await worker.fetch(allowedRequest, mockEnv);
      expect(allowedResponse.status).toBe(200);
    });
  });

  describe('Email-based rate limiting', () => {
    it('should allow requests within email limit', async () => {
      const email = 'user@example.com';
      const formData = { ...validFormData, email };

      // Make 3 requests (limit is 3)
      for (let i = 0; i < 3; i++) {
        const request = createRequest(formData, `192.168.1.${i + 100}`); // Different IPs
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(200);

        const data = (await response.json()) as any;
        expect(data.ok).toBe(true);

        // Check rate limit headers
        expect(response.headers.get('X-RateLimit-Remaining-Email')).toBe(
          (2 - i).toString()
        );
      }
    });

    it('should block requests after email limit is exceeded', async () => {
      const email = 'blocked@example.com';
      const formData = { ...validFormData, email };

      // Exhaust the limit
      for (let i = 0; i < 3; i++) {
        const request = createRequest(formData, `192.168.1.${i + 200}`); // Different IPs
        await worker.fetch(request, mockEnv);
      }

      // Next request should be rate limited
      const blockedRequest = createRequest(formData, '192.168.1.203'); // New IP
      const response = await worker.fetch(blockedRequest, mockEnv);

      expect(response.status).toBe(429);

      const data = (await response.json()) as any;
      expect(data.ok).toBe(false);
      expect(data.errorCode).toBe('rate_limit');
      expect(data.metadata.type).toBe('email');
      expect(data.metadata.remaining).toBe(0);
    });

    it('should handle different emails independently', async () => {
      const email1 = 'user1@example.com';
      const email2 = 'user2@example.com';

      // Exhaust limit for email1
      for (let i = 0; i < 3; i++) {
        const request = createRequest(
          { ...validFormData, email: email1 },
          `192.168.1.${i + 50}`
        );
        await worker.fetch(request, mockEnv);
      }

      // email1 should be blocked
      const blockedRequest = createRequest(
        { ...validFormData, email: email1 },
        '192.168.1.53'
      );
      const blockedResponse = await worker.fetch(blockedRequest, mockEnv);
      expect(blockedResponse.status).toBe(429);

      // email2 should still be allowed
      const allowedRequest = createRequest(
        { ...validFormData, email: email2 },
        '192.168.1.54'
      );
      const allowedResponse = await worker.fetch(allowedRequest, mockEnv);
      expect(allowedResponse.status).toBe(200);
    });
  });

  describe('Combined rate limiting scenarios', () => {
    it('should enforce both IP and email limits', async () => {
      const ip = '10.0.0.1';

      // Exhaust IP limit
      for (let i = 0; i < 3; i++) {
        const request = createRequest(
          { ...validFormData, email: `user${i}@example.com` },
          ip
        );
        const response = await worker.fetch(request, mockEnv);
        expect(response.status).toBe(200);
      }

      // IP should be blocked even with new email
      const ipBlockedRequest = createRequest(
        { ...validFormData, email: 'newemail@example.com' },
        ip
      );
      const ipBlockedResponse = await worker.fetch(ipBlockedRequest, mockEnv);
      expect(ipBlockedResponse.status).toBe(429);

      const ipBlockedData = (await ipBlockedResponse.json()) as any;
      expect(ipBlockedData.metadata.type).toBe('ip');
    });

    it('should check IP rate limit before email validation', async () => {
      const ip = '10.0.0.2';

      // Exhaust IP limit with valid requests
      for (let i = 0; i < 3; i++) {
        const request = createRequest(validFormData, ip);
        await worker.fetch(request, mockEnv);
      }

      // IP should be blocked even with invalid JSON
      const invalidRequest = new Request('http://localhost:8787/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': ip,
        },
        body: 'invalid json',
      });

      const response = await worker.fetch(invalidRequest, mockEnv);
      expect(response.status).toBe(429);

      const data = (await response.json()) as any;
      expect(data.metadata.type).toBe('ip');
    });
  });

  describe('Rate limit headers', () => {
    it('should include correct rate limit headers in successful responses', async () => {
      const request = createRequest(validFormData);
      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(200);
      expect(response.headers.get('X-RateLimit-Limit')).toBe('3');
      expect(response.headers.get('X-RateLimit-Remaining-IP')).toBe('2');
      expect(response.headers.get('X-RateLimit-Remaining-Email')).toBe('2');
      expect(response.headers.get('X-RateLimit-Reset')).toMatch(/^\d+$/); // Unix timestamp
    });

    it('should include correct rate limit headers in rate limited responses', async () => {
      const ip = '10.0.0.3';

      // Exhaust the limit
      for (let i = 0; i < 3; i++) {
        const request = createRequest(validFormData, ip);
        await worker.fetch(request, mockEnv);
      }

      // Get rate limited response
      const blockedRequest = createRequest(validFormData, ip);
      const response = await worker.fetch(blockedRequest, mockEnv);

      expect(response.status).toBe(429);
      expect(response.headers.get('X-RateLimit-Limit')).toBe('3');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(response.headers.get('X-RateLimit-Reset')).toMatch(/^\d+$/);
    });
  });

  describe('Environment configuration', () => {
    it('should use default rate limit when env vars are not set', async () => {
      const envWithoutRateLimit = {
        SLACK_BOT_TOKEN: 'test-token',
        SLACK_TEAM_ID: 'test-team',
        SLACK_LOG_CHANNEL_ID: 'test-channel',
        POSTMARK_API_KEY: 'test-key',
      } as any;

      const request = createRequest(validFormData);
      const response = await worker.fetch(request, envWithoutRateLimit);

      expect(response.status).toBe(200);
      expect(response.headers.get('X-RateLimit-Limit')).toBe('10'); // Default limit
    });

    it('should handle custom rate limit from environment', async () => {
      const customEnv = {
        ...mockEnv,
        RATE_LIMIT: '1', // Very low limit for testing
        RATE_LIMIT_WINDOW_SEC: '30',
      };

      // First request should succeed
      const request1 = createRequest(validFormData);
      const response1 = await worker.fetch(request1, customEnv);
      expect(response1.status).toBe(200);
      expect(response1.headers.get('X-RateLimit-Limit')).toBe('1');

      // Second request should be blocked
      const request2 = createRequest(validFormData);
      const response2 = await worker.fetch(request2, customEnv);
      expect(response2.status).toBe(429);
    });
  });

  describe('Edge cases', () => {
    it('should handle missing CF-Connecting-IP header', async () => {
      const request = new Request('http://localhost:8787/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // No IP headers
        },
        body: JSON.stringify(validFormData),
      });

      const response = await worker.fetch(request, mockEnv);
      expect(response.status).toBe(200); // Should still work with 'unknown' IP
    });

    it('should prioritize CF-Connecting-IP over X-Forwarded-For', async () => {
      const request = new Request('http://localhost:8787/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '10.0.0.1',
          'X-Forwarded-For': '10.0.0.2',
        },
        body: JSON.stringify(validFormData),
      });

      // Should use CF-Connecting-IP (10.0.0.1)
      const response = await worker.fetch(request, mockEnv);
      expect(response.status).toBe(200);

      // Exhaust limit for 10.0.0.1
      for (let i = 0; i < 2; i++) {
        await worker.fetch(request, mockEnv);
      }

      // Should be blocked
      const blockedResponse = await worker.fetch(request, mockEnv);
      expect(blockedResponse.status).toBe(429);

      // But 10.0.0.2 should still work
      const request2 = new Request('http://localhost:8787/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '10.0.0.2',
        },
        body: JSON.stringify(validFormData),
      });

      const allowedResponse = await worker.fetch(request2, mockEnv);
      expect(allowedResponse.status).toBe(200);
    });
  });
});
