import { describe, it, expect, vi } from 'vitest';
import type { Env } from './types';

// Mock global fetch and Request/Response
global.Request = global.Request || class Request {
  url: string;
  method: string;
  headers: Map<string, string>;
  body: ReadableStream | null;
  
  constructor(input: string, init?: RequestInit) {
    this.url = input;
    this.method = init?.method || 'GET';
    this.headers = new Map();
    this.body = null;
    
    if (init?.headers) {
      Object.entries(init.headers as Record<string, string>).forEach(([k, v]) => {
        this.headers.set(k, v);
      });
    }
    
    if (init?.body) {
      this.body = init.body as ReadableStream;
    }
  }

  async json() {
    if (this.body && typeof this.body === 'string') {
      return JSON.parse(this.body);
    }
    return {};
  }
} as any;

global.Response = global.Response || class Response {
  status: number;
  headers: Map<string, string>;
  body: string;
  
  constructor(body?: string | null, init?: ResponseInit) {
    this.body = body || '';
    this.status = init?.status || 200;
    this.headers = new Map();
    
    if (init?.headers) {
      Object.entries(init.headers as Record<string, string>).forEach(([k, v]) => {
        this.headers.set(k, v);
      });
    }
  }

  async text() {
    return this.body;
  }

  async json() {
    return JSON.parse(this.body);
  }
} as any;

// Import worker after globals are set
const workerModule = await import('./index');
const worker = workerModule.default;

// Mock environment
const mockEnv: Env = {
  SLACK_BOT_TOKEN: 'xoxb-mock-token',
  SLACK_TEAM_ID: 'T123456789',
  SLACK_LOG_CHANNEL_ID: 'C123456789',
  POSTMARK_API_KEY: 'mock-postmark-key',
  RATE_LIMIT: '5',
  RATE_LIMIT_WINDOW_SEC: '3600',
};

describe('Cloudflare Worker', () => {
  describe('GET /api/ping', () => {
    it('should return health check response', async () => {
      const request = new Request('http://localhost:8787/api/ping', {
        method: 'GET',
      });

      const response = await worker.fetch(request, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        ok: true,
        version: '0.1.0',
      });
    });
  });

  describe('POST /api/submit', () => {
    it('should return 400 for invalid JSON', async () => {
      const request = new Request('http://localhost:8787/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const response = await worker.fetch(request, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        ok: false,
        errorCode: 'INVALID_JSON',
        message: 'Invalid JSON in request body',
      });
    });

    it('should return 400 for missing companyName', async () => {
      const request = new Request('http://localhost:8787/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      const response = await worker.fetch(request, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        ok: false,
        errorCode: 'MISSING_COMPANY_NAME',
        message: 'companyName is required and must be a string',
      });
    });

    it('should return 400 for invalid email format', async () => {
      const request = new Request('http://localhost:8787/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: 'Test Company',
          email: 'invalid-email',
        }),
      });

      const response = await worker.fetch(request, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        ok: false,
        errorCode: 'INVALID_EMAIL_FORMAT',
        message: 'Invalid email format',
      });
    });

    it('should return 200 with sanitized company name for valid request', async () => {
      const request = new Request('http://localhost:8787/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: 'Test Company Inc.',
          email: 'test@example.com',
        }),
      });

      const response = await worker.fetch(request, mockEnv);
      const data = await response.json() as any;

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.sanitizedCompanyName).toBe('test-company-inc.');
      expect(typeof data.id).toBe('string');
      expect(data.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    });
  });

  describe('Static file serving', () => {
    it('should serve HTML for root path', async () => {
      const request = new Request('http://localhost:8787/', {
        method: 'GET',
      });

      const response = await worker.fetch(request, mockEnv);
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/html');
      expect(html).toContain('Conference Slack Form');
      expect(html).toContain('/api/ping');
    });

    it('should return 404 for unknown routes', async () => {
      const request = new Request('http://localhost:8787/unknown', {
        method: 'GET',
      });

      const response = await worker.fetch(request, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({
        ok: false,
        errorCode: 'NOT_FOUND',
        message: 'File not found',
      });
    });
  });

  describe('CORS', () => {
    it('should handle OPTIONS requests', async () => {
      const request = new Request('http://localhost:8787/api/ping', {
        method: 'OPTIONS',
      });

      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
    });
  });
});
