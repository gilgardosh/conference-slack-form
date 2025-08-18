/**
 * In-memory rate limiter for Cloudflare Worker
 *
 * LIMITATIONS:
 * - This is an in-memory solution suitable for single-instance deployments only
 * - In multi-instance deployments, each worker instance maintains its own counter
 * - For distributed rate limiting, consider using Cloudflare KV, Durable Objects, or external services
 * - Memory usage grows with the number of unique keys
 * - No automatic cleanup of expired entries (relies on access-based cleanup)
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // epoch milliseconds
}

interface RateLimitEntry {
  count: number;
  resetTime: number; // epoch milliseconds
}

/**
 * In-memory rate limiter using Map-based storage
 */
export class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();

  /**
   * Check if the request is allowed and increment the counter
   *
   * @param key - Unique identifier for the rate limit (e.g., 'ip:127.0.0.1' or 'email:user@example.com')
   * @param limit - Maximum number of requests allowed in the time window
   * @param windowSec - Time window in seconds
   * @returns Rate limit result with allowed status, remaining count, and reset time
   */
  checkAndIncrement(
    key: string,
    limit: number,
    windowSec: number
  ): RateLimitResult {
    const now = Date.now();
    const windowMs = windowSec * 1000;

    // Handle zero limit case
    if (limit <= 0) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: now + windowMs,
      };
    }

    // Get or create entry
    const entry = this.store.get(key);

    // If no entry exists or the window has expired, start fresh
    if (!entry || now >= entry.resetTime) {
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + windowMs,
      };
      this.store.set(key, newEntry);

      return {
        allowed: true,
        remaining: Math.max(0, limit - 1),
        resetAt: newEntry.resetTime,
      };
    }

    // Check if limit is exceeded
    if (entry.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetTime,
      };
    }

    // Increment counter
    entry.count++;
    this.store.set(key, entry);

    return {
      allowed: true,
      remaining: Math.max(0, limit - entry.count),
      resetAt: entry.resetTime,
    };
  }

  /**
   * Get current status for a key without incrementing
   *
   * @param key - Unique identifier for the rate limit
   * @param limit - Maximum number of requests allowed in the time window
   * @returns Current rate limit status
   */
  getStatus(
    key: string,
    limit: number
  ): { count: number; remaining: number; resetAt: number | null } {
    const entry = this.store.get(key);
    const now = Date.now();

    if (!entry || now >= entry.resetTime) {
      return {
        count: 0,
        remaining: limit,
        resetAt: null,
      };
    }

    return {
      count: entry.count,
      remaining: Math.max(0, limit - entry.count),
      resetAt: entry.resetTime,
    };
  }

  /**
   * Clear all rate limit entries (useful for testing)
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Remove expired entries to prevent memory leaks
   * Call this periodically if you have many unique keys
   */
  cleanup(): number {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetTime) {
        this.store.delete(key);
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * Get the number of tracked keys
   */
  size(): number {
    return this.store.size;
  }
}

// Global rate limiter instance
const rateLimiter = new RateLimiter();

/**
 * Check rate limit for IP address
 *
 * @param ip - IP address
 * @param limit - Maximum requests per window
 * @param windowSec - Time window in seconds
 * @returns Rate limit result
 */
export function checkIpRateLimit(
  ip: string,
  limit: number,
  windowSec: number
): RateLimitResult {
  return rateLimiter.checkAndIncrement(`ip:${ip}`, limit, windowSec);
}

/**
 * Check rate limit for email address
 *
 * @param email - Email address
 * @param limit - Maximum requests per window
 * @param windowSec - Time window in seconds
 * @returns Rate limit result
 */
export function checkEmailRateLimit(
  email: string,
  limit: number,
  windowSec: number
): RateLimitResult {
  return rateLimiter.checkAndIncrement(`email:${email}`, limit, windowSec);
}

/**
 * Get the global rate limiter instance (useful for testing and cleanup)
 */
export function getRateLimiter(): RateLimiter {
  return rateLimiter;
}
