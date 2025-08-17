import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env } from './types';

// Mock Slack and Email services
vi.mock('./lib/slack', () => ({
  createSlackClient: vi.fn(() => ({
    logToChannel: vi.fn().mockResolvedValue({ ok: true, timestamp: '1234567890.123456' }),
    createChannel: vi.fn().mockResolvedValue({ 
      ok: true, 
      channelId: 'C1234567890', 
      channelName: 'test-company-inc' 
    }),
    inviteGroup: vi.fn().mockResolvedValue({ ok: true, invited: true }),
    inviteGuest: vi.fn().mockResolvedValue({ ok: true, invited: true }),
  }))
}));

vi.mock('./lib/email', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue({ ok: true })
}));

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
  ASSETS: {
    fetch: vi.fn().mockResolvedValue(new Response('mock asset')),
  } as unknown as Fetcher,
  SLACK_BOT_TOKEN: 'xoxb-mock-token',
  SLACK_TEAM_ID: 'T123456789',
  SLACK_LOG_CHANNEL_ID: 'C123456789',
  POSTMARK_API_KEY: 'mock-postmark-key',
  RATE_LIMIT: '5',
  RATE_LIMIT_WINDOW_SEC: '3600',
};

describe('Cloudflare Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

    it('should return 422 for missing companyName', async () => {
      const request = new Request('http://localhost:8787/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      const response = await worker.fetch(request, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data).toEqual({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        errors: ['companyName: Required']
      });
    });

    it('should return 422 for invalid email format', async () => {
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

      expect(response.status).toBe(422);
      expect(data).toEqual({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        errors: ['email: Invalid email format']
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
      expect(data.sanitizedCompanyName).toBe('test-company-inc');
      expect(typeof data.id).toBe('string');
      expect(data.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    });
  });

  describe('Routing', () => {
    it.skip('should return 404 for non-API routes', async () => {
      const request = new Request('http://localhost:8787/', {
        method: 'GET',
      });

      const response = await worker.fetch(request, mockEnv);
      expect(response.status).toBe(404);
      const data = (await response.json()) as { ok: boolean; errorCode: string; message: string };
      expect(data).toEqual({
        ok: false,
        errorCode: 'NOT_FOUND',
        message: 'API endpoint not found',
      });
    });

    it('should return 404 for unknown API routes', async () => {
      const request = new Request('http://localhost:8787/api/unknown', {
        method: 'GET',
      });

      const response = await worker.fetch(request, mockEnv);
      
      expect(response.status).toBe(404);
      
      const data = await response.json();
      expect(data).toEqual({
        ok: false,
        errorCode: 'NOT_FOUND',
        message: 'API endpoint not found',
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
