import type { Env } from './types';
import { getCorsHeaders } from './cors';

/**
 * Generate a simple UUID v4 using crypto.randomUUID if available,
 * fallback to a simple implementation
 */
export function generateId(): string {
  // Use crypto.randomUUID if available (Cloudflare Workers support this)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Create a JSON response with CORS headers
 */
export function jsonResponse(
  env: Env,
  data: unknown,
  status = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(env),
      ...headers,
    },
  });
}

/**
 * Create an error response
 */
export function errorResponse(
  env: Env,
  errorCode: string,
  message: string,
  status = 400,
  metadata?: Record<string, unknown>
): Response {
  const body = {
    ok: false,
    errorCode,
    message,
    ...(metadata && { metadata }),
  };

  return jsonResponse(env, body, status);
}

/**
 * Placeholder sanitization function (will be enhanced in next milestone)
 */
export function sanitizeCompanyNamePreview(companyName: string): string {
  return companyName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .slice(0, 67);
}
