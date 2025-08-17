/**
 * Rate limiter expiry tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getRateLimiter, checkIpRateLimit, checkEmailRateLimit } from '../lib/rateLimiter';

describe('Rate Limiter Expiry', () => {
  let originalNow: typeof Date.now;

  beforeEach(() => {
    getRateLimiter().clear();
    originalNow = Date.now;
  });

  afterEach(() => {
    Date.now = originalNow;
  });

  it('should allow requests after IP rate limit expires', () => {
    const ip = '192.168.1.100';
    const limit = 2;
    const windowSec = 10; // 10 seconds
    
    // Mock initial time
    let currentTime = 1000000;
    Date.now = vi.fn(() => currentTime);

    // Exhaust the limit
    const result1 = checkIpRateLimit(ip, limit, windowSec);
    expect(result1.allowed).toBe(true);
    expect(result1.remaining).toBe(1);

    const result2 = checkIpRateLimit(ip, limit, windowSec);
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(0);

    // Should be blocked
    const result3 = checkIpRateLimit(ip, limit, windowSec);
    expect(result3.allowed).toBe(false);
    expect(result3.remaining).toBe(0);

    // Move time forward by window duration + 1ms
    currentTime += (windowSec * 1000) + 1;

    // Should be allowed again
    const result4 = checkIpRateLimit(ip, limit, windowSec);
    expect(result4.allowed).toBe(true);
    expect(result4.remaining).toBe(1);
  });

  it('should allow requests after email rate limit expires', () => {
    const email = 'test@example.com';
    const limit = 2;
    const windowSec = 10; // 10 seconds
    
    // Mock initial time
    let currentTime = 2000000;
    Date.now = vi.fn(() => currentTime);

    // Exhaust the limit
    const result1 = checkEmailRateLimit(email, limit, windowSec);
    expect(result1.allowed).toBe(true);
    expect(result1.remaining).toBe(1);

    const result2 = checkEmailRateLimit(email, limit, windowSec);
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(0);

    // Should be blocked
    const result3 = checkEmailRateLimit(email, limit, windowSec);
    expect(result3.allowed).toBe(false);
    expect(result3.remaining).toBe(0);

    // Move time forward by window duration + 1ms
    currentTime += (windowSec * 1000) + 1;

    // Should be allowed again
    const result4 = checkEmailRateLimit(email, limit, windowSec);
    expect(result4.allowed).toBe(true);
    expect(result4.remaining).toBe(1);
  });

  it('should handle partial expiry with sliding window', () => {
    const ip = '192.168.1.101';
    const limit = 3;
    const windowSec = 60; // 1 minute
    
    // Mock initial time
    let currentTime = 3000000;
    Date.now = vi.fn(() => currentTime);

    // Make 3 requests at different times within the window
    const result1 = checkIpRateLimit(ip, limit, windowSec);
    expect(result1.allowed).toBe(true);
    expect(result1.remaining).toBe(2);

    // 20 seconds later
    currentTime += 20 * 1000;
    const result2 = checkIpRateLimit(ip, limit, windowSec);
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(1);

    // 20 seconds later (40s total)
    currentTime += 20 * 1000;
    const result3 = checkIpRateLimit(ip, limit, windowSec);
    expect(result3.allowed).toBe(true);
    expect(result3.remaining).toBe(0);

    // Should be blocked now
    const result4 = checkIpRateLimit(ip, limit, windowSec);
    expect(result4.allowed).toBe(false);

    // 25 seconds later (65s total) - first request should expire
    currentTime += 25 * 1000;
    const result5 = checkIpRateLimit(ip, limit, windowSec);
    expect(result5.allowed).toBe(true);
    expect(result5.remaining).toBe(2); // Should have more remaining since first request expired
  });

  it('should handle rate limit reset time correctly', () => {
    const email = 'test2@example.com';
    const limit = 1;
    const windowSec = 30;
    
    let currentTime = 4000000;
    Date.now = vi.fn(() => currentTime);

    // Use up the limit
    const result1 = checkEmailRateLimit(email, limit, windowSec);
    expect(result1.allowed).toBe(true);
    expect(result1.remaining).toBe(0);

    // Should be blocked and reset time should be set correctly
    const result2 = checkEmailRateLimit(email, limit, windowSec);
    expect(result2.allowed).toBe(false);
    expect(result2.resetAt).toBe(currentTime + (windowSec * 1000));

    // Move time to just before reset
    currentTime = result2.resetAt - 1;
    const result3 = checkEmailRateLimit(email, limit, windowSec);
    expect(result3.allowed).toBe(false);

    // Move time to exactly at reset
    currentTime = result2.resetAt;
    const result4 = checkEmailRateLimit(email, limit, windowSec);
    expect(result4.allowed).toBe(true);
    expect(result4.remaining).toBe(0);
  });
});
