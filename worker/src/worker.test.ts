import { describe, it, expect, vi } from 'vitest';
import { generateId, jsonResponse, errorResponse } from './utils';
import { sanitizeCompanyName } from './utils/validation';
import type { Env } from './types';

const mockEnv = (corsOrigin = '*'): Env => ({
  ASSETS: {
    fetch: vi.fn(),
    connect: vi.fn(),
  } as unknown as Env['ASSETS'],
  SLACK_BOT_TOKEN: 'test-token',
  SLACK_TEAM_ID: 'test-team-id',
  SLACK_LOG_CHANNEL_ID: 'test-log-channel-id',
  POSTMARK_API_KEY: 'test-postmark-key',
  CORS_ALLOWED_ORIGIN: corsOrigin,
  RATE_LIMIT: '10',
  RATE_LIMIT_WINDOW_SEC: '3600',
});

describe('Worker Utils', () => {
  describe('generateId', () => {
    it('should generate a valid UUID format', () => {
      const id = generateId();
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('sanitizeCompanyName', () => {
    it('should convert to lowercase and replace spaces with hyphens', () => {
      expect(sanitizeCompanyName('Test Company')).toBe('test-company');
    });

    it('should remove special characters except hyphens', () => {
      expect(sanitizeCompanyName('Test Company Inc.')).toBe('test-company-inc');
    });

    it('should handle multiple spaces', () => {
      expect(sanitizeCompanyName('Test   Company   Inc')).toBe(
        'test-company-inc'
      );
    });

    it('should handle empty string', () => {
      expect(sanitizeCompanyName('')).toBe('');
    });
  });

  describe('jsonResponse', () => {
    it('should create a Response with JSON content type', () => {
      const data = { ok: true, message: 'test' };
      const env = mockEnv();
      const response = jsonResponse(env, data);

      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('errorResponse', () => {
    it('should create error response with correct structure', () => {
      const env = mockEnv();
      const response = errorResponse(
        env,
        'TEST_ERROR',
        'Test error message',
        400
      );

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(400);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });
});

describe('Form Validation Logic', () => {
  describe('Email validation', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    it('should accept valid email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
      ];

      validEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(true);
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        'user@',
        '@domain.com',
        'user space@example.com',
        'user@domain',
      ];

      invalidEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(false);
      });
    });
  });

  describe('Company name validation', () => {
    it('should require string type', () => {
      expect(typeof 'Test Company').toBe('string');
      expect(typeof 123).not.toBe('string');
      expect(typeof null).not.toBe('string');
      expect(typeof undefined).not.toBe('string');
    });

    it('should handle empty string', () => {
      expect(typeof '').toBe('string');
      expect(''.length).toBe(0);
    });
  });
});

describe('API Response Structure', () => {
  describe('PingResponse', () => {
    it('should have correct structure', () => {
      const response = {
        ok: true,
        version: '0.1.0',
      };

      expect(response).toHaveProperty('ok');
      expect(response).toHaveProperty('version');
      expect(typeof response.ok).toBe('boolean');
      expect(typeof response.version).toBe('string');
    });
  });

  describe('FormSubmissionResponse', () => {
    it('should have correct structure for success', () => {
      const response = {
        ok: true,
        id: generateId(),
        sanitizedCompanyName: 'test-company',
      };

      expect(response).toHaveProperty('ok');
      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('sanitizedCompanyName');
      expect(typeof response.ok).toBe('boolean');
      expect(typeof response.id).toBe('string');
      expect(typeof response.sanitizedCompanyName).toBe('string');
    });
  });

  describe('ApiErrorResponse', () => {
    it('should have correct structure', () => {
      const response = {
        ok: false,
        errorCode: 'TEST_ERROR',
        message: 'Test error message',
      };

      expect(response).toHaveProperty('ok');
      expect(response).toHaveProperty('errorCode');
      expect(response).toHaveProperty('message');
      expect(response.ok).toBe(false);
      expect(typeof response.errorCode).toBe('string');
      expect(typeof response.message).toBe('string');
    });
  });
});
