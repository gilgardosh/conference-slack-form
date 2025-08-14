/**
 * Environment variables interface for the Cloudflare Worker
 */
export interface Env {
  SLACK_BOT_TOKEN: string;
  SLACK_TEAM_ID: string;
  SLACK_LOG_CHANNEL_ID: string;
  POSTMARK_API_KEY: string;
  RATE_LIMIT: string; // Number as string from environment
  RATE_LIMIT_WINDOW_SEC: string; // Number as string from environment
}

/**
 * Form submission request body
 */
export interface FormSubmissionRequest {
  companyName: string;
  email: string;
}

/**
 * API response types
 */
export interface ApiSuccessResponse<T = unknown> {
  ok: true;
  data: T;
}

export interface ApiErrorResponse {
  ok: false;
  errorCode: string;
  message: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Rate limiter types
 */
export interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Validation result types
 */
export interface ValidationSuccess<T> {
  ok: true;
  value: T;
}

export interface ValidationError {
  ok: false;
  errors: string[];
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationError;
