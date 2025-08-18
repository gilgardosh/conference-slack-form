import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RateLimiter,
  checkIpRateLimit,
  checkEmailRateLimit,
  getRateLimiter,
} from './rateLimiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter();
  });

  describe('basic functionality', () => {
    it('should allow requests within limit', () => {
      const result1 = rateLimiter.checkAndIncrement('test:key', 3, 60);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(2);
      expect(result1.resetAt).toBeGreaterThan(Date.now());

      const result2 = rateLimiter.checkAndIncrement('test:key', 3, 60);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(1);

      const result3 = rateLimiter.checkAndIncrement('test:key', 3, 60);
      expect(result3.allowed).toBe(true);
      expect(result3.remaining).toBe(0);
    });

    it('should block requests after limit is exceeded', () => {
      // Fill up the limit
      for (let i = 0; i < 3; i++) {
        const result = rateLimiter.checkAndIncrement('test:key', 3, 60);
        expect(result.allowed).toBe(true);
      }

      // Should be blocked now
      const blockedResult = rateLimiter.checkAndIncrement('test:key', 3, 60);
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.remaining).toBe(0);

      // Should still be blocked
      const stillBlockedResult = rateLimiter.checkAndIncrement(
        'test:key',
        3,
        60
      );
      expect(stillBlockedResult.allowed).toBe(false);
      expect(stillBlockedResult.remaining).toBe(0);
    });

    it('should handle different keys independently', () => {
      // Fill up limit for first key
      for (let i = 0; i < 3; i++) {
        rateLimiter.checkAndIncrement('test:key1', 3, 60);
      }

      // First key should be blocked
      const blocked = rateLimiter.checkAndIncrement('test:key1', 3, 60);
      expect(blocked.allowed).toBe(false);

      // Second key should still be allowed
      const allowed = rateLimiter.checkAndIncrement('test:key2', 3, 60);
      expect(allowed.allowed).toBe(true);
      expect(allowed.remaining).toBe(2);
    });
  });

  describe('time window expiry', () => {
    it('should reset counter after window expires', async () => {
      let currentTime = 1000000;
      vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

      try {
        // Fill up the limit
        for (let i = 0; i < 3; i++) {
          const result = rateLimiter.checkAndIncrement('test:key', 3, 1); // 1 second window
          expect(result.allowed).toBe(true);
        }

        // Should be blocked
        const blocked = rateLimiter.checkAndIncrement('test:key', 3, 1);
        expect(blocked.allowed).toBe(false);

        // Advance time by 1.1 seconds
        currentTime += 1100;

        // Should be allowed again (new window)
        const renewed = rateLimiter.checkAndIncrement('test:key', 3, 1);
        expect(renewed.allowed).toBe(true);
        expect(renewed.remaining).toBe(2);
      } finally {
        vi.restoreAllMocks();
      }
    });

    it('should provide accurate resetAt timestamp', () => {
      const now = Date.now();
      const windowSec = 60;

      const result = rateLimiter.checkAndIncrement('test:key', 3, windowSec);

      expect(result.resetAt).toBeGreaterThanOrEqual(now + windowSec * 1000);
      expect(result.resetAt).toBeLessThanOrEqual(now + windowSec * 1000 + 100); // Allow 100ms tolerance
    });
  });

  describe('burst testing', () => {
    it('should handle burst of requests correctly', () => {
      const limit = 5;
      const windowSec = 60;
      const burstSize = 10;

      const results = [];
      for (let i = 0; i < burstSize; i++) {
        results.push(
          rateLimiter.checkAndIncrement('burst:test', limit, windowSec)
        );
      }

      // First 5 should be allowed
      for (let i = 0; i < limit; i++) {
        expect(results[i]!.allowed).toBe(true);
        expect(results[i]!.remaining).toBe(limit - 1 - i);
      }

      // Remaining should be blocked
      for (let i = limit; i < burstSize; i++) {
        expect(results[i]!.allowed).toBe(false);
        expect(results[i]!.remaining).toBe(0);
      }
    });

    it('should handle concurrent-like bursts with same resetAt', () => {
      const limit = 3;
      const windowSec = 60;

      // Simulate rapid succession requests
      const results = [];

      for (let i = 0; i < 5; i++) {
        results.push(
          rateLimiter.checkAndIncrement('concurrent:test', limit, windowSec)
        );
      }

      // All should have the same resetAt (within tolerance)
      const resetTimes = results.map(r => r.resetAt);
      const firstResetTime = resetTimes[0]!;

      resetTimes.forEach(resetTime => {
        expect(Math.abs(resetTime - firstResetTime)).toBeLessThan(10); // 10ms tolerance
      });

      // First 3 allowed, last 2 blocked
      expect(results.slice(0, 3).every(r => r.allowed)).toBe(true);
      expect(results.slice(3).every(r => !r.allowed)).toBe(true);
    });
  });

  describe('getStatus method', () => {
    it('should return status without incrementing counter', () => {
      // Add some requests
      rateLimiter.checkAndIncrement('status:test', 5, 60);
      rateLimiter.checkAndIncrement('status:test', 5, 60);

      // Check status multiple times
      const status1 = rateLimiter.getStatus('status:test', 5);
      const status2 = rateLimiter.getStatus('status:test', 5);

      expect(status1.count).toBe(2);
      expect(status1.remaining).toBe(3);
      expect(status2.count).toBe(2); // Should not increment
      expect(status2.remaining).toBe(3);

      // Verify counter didn't change
      const nextRequest = rateLimiter.checkAndIncrement('status:test', 5, 60);
      expect(nextRequest.remaining).toBe(2); // Should be 3rd request
    });

    it('should return empty status for non-existent key', () => {
      const status = rateLimiter.getStatus('nonexistent:key', 10);

      expect(status.count).toBe(0);
      expect(status.remaining).toBe(10);
      expect(status.resetAt).toBe(null);
    });
  });

  describe('utility methods', () => {
    it('should clear all entries', () => {
      rateLimiter.checkAndIncrement('key1', 3, 60);
      rateLimiter.checkAndIncrement('key2', 3, 60);

      expect(rateLimiter.size()).toBe(2);

      rateLimiter.clear();

      expect(rateLimiter.size()).toBe(0);

      // Should start fresh
      const result = rateLimiter.checkAndIncrement('key1', 3, 60);
      expect(result.remaining).toBe(2);
    });

    it('should cleanup expired entries', () => {
      let currentTime = 1000000;
      vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

      try {
        // Add entries
        rateLimiter.checkAndIncrement('key1', 3, 1); // 1 second window
        rateLimiter.checkAndIncrement('key2', 3, 2); // 2 second window

        expect(rateLimiter.size()).toBe(2);

        // Advance time by 1.5 seconds
        currentTime += 1500;

        // Cleanup should remove only key1
        const removed = rateLimiter.cleanup();
        expect(removed).toBe(1);
        expect(rateLimiter.size()).toBe(1);

        // key2 should still exist
        const status = rateLimiter.getStatus('key2', 3);
        expect(status.count).toBe(1);
      } finally {
        vi.restoreAllMocks();
      }
    });
  });
});

describe('Helper functions', () => {
  beforeEach(() => {
    // Clear the global rate limiter before each test
    getRateLimiter().clear();
  });

  describe('checkIpRateLimit', () => {
    it('should rate limit by IP address', () => {
      const ip = '192.168.1.1';
      const limit = 3;
      const windowSec = 60;

      // First requests should be allowed
      for (let i = 0; i < limit; i++) {
        const result = checkIpRateLimit(ip, limit, windowSec);
        expect(result.allowed).toBe(true);
      }

      // Next request should be blocked
      const blocked = checkIpRateLimit(ip, limit, windowSec);
      expect(blocked.allowed).toBe(false);
    });

    it('should handle different IPs independently', () => {
      const ip1 = '192.168.1.1';
      const ip2 = '192.168.1.2';
      const limit = 2;
      const windowSec = 60;

      // Fill up limit for IP1
      checkIpRateLimit(ip1, limit, windowSec);
      checkIpRateLimit(ip1, limit, windowSec);

      const blocked = checkIpRateLimit(ip1, limit, windowSec);
      expect(blocked.allowed).toBe(false);

      // IP2 should still be allowed
      const allowed = checkIpRateLimit(ip2, limit, windowSec);
      expect(allowed.allowed).toBe(true);
    });
  });

  describe('checkEmailRateLimit', () => {
    it('should rate limit by email address', () => {
      const email = 'user@example.com';
      const limit = 2;
      const windowSec = 60;

      // First requests should be allowed
      for (let i = 0; i < limit; i++) {
        const result = checkEmailRateLimit(email, limit, windowSec);
        expect(result.allowed).toBe(true);
      }

      // Next request should be blocked
      const blocked = checkEmailRateLimit(email, limit, windowSec);
      expect(blocked.allowed).toBe(false);
    });

    it('should handle different emails independently', () => {
      const email1 = 'user1@example.com';
      const email2 = 'user2@example.com';
      const limit = 1;
      const windowSec = 60;

      // Fill up limit for email1
      const firstEmail1 = checkEmailRateLimit(email1, limit, windowSec);
      expect(firstEmail1.allowed).toBe(true);

      const secondEmail1 = checkEmailRateLimit(email1, limit, windowSec);
      expect(secondEmail1.allowed).toBe(false);

      // email2 should still be allowed
      const firstEmail2 = checkEmailRateLimit(email2, limit, windowSec);
      expect(firstEmail2.allowed).toBe(true);
    });
  });

  describe('integration with global instance', () => {
    it('should use the same global instance', () => {
      const ip = '10.0.0.1';
      const email = 'test@example.com';

      // Use helper functions
      checkIpRateLimit(ip, 3, 60);
      checkEmailRateLimit(email, 3, 60);

      // Should see both keys in global instance
      expect(getRateLimiter().size()).toBe(2);

      // Direct access should show the same state
      const ipStatus = getRateLimiter().getStatus(`ip:${ip}`, 3);
      const emailStatus = getRateLimiter().getStatus(`email:${email}`, 3);

      expect(ipStatus.count).toBe(1);
      expect(emailStatus.count).toBe(1);
    });
  });
});

describe('Edge cases and stress testing', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter();
  });

  it('should handle zero limit', () => {
    const result = rateLimiter.checkAndIncrement('zero:limit', 0, 60);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should handle limit of 1', () => {
    const first = rateLimiter.checkAndIncrement('single:limit', 1, 60);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(0);

    const second = rateLimiter.checkAndIncrement('single:limit', 1, 60);
    expect(second.allowed).toBe(false);
    expect(second.remaining).toBe(0);
  });

  it('should handle very short time windows', () => {
    let currentTime = 1000000;
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

    try {
      // 0.1 second window
      const result1 = rateLimiter.checkAndIncrement('short:window', 2, 0.1);
      expect(result1.allowed).toBe(true);

      const result2 = rateLimiter.checkAndIncrement('short:window', 2, 0.1);
      expect(result2.allowed).toBe(true);

      const result3 = rateLimiter.checkAndIncrement('short:window', 2, 0.1);
      expect(result3.allowed).toBe(false);

      // Advance by 101ms
      currentTime += 101;

      const result4 = rateLimiter.checkAndIncrement('short:window', 2, 0.1);
      expect(result4.allowed).toBe(true);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('should handle large limits', () => {
    const limit = 1000;
    let lastRemaining = limit;

    for (let i = 0; i < limit; i++) {
      const result = rateLimiter.checkAndIncrement('large:limit', limit, 60);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(lastRemaining - 1);
      lastRemaining = result.remaining;
    }

    // Should be blocked now
    const blocked = rateLimiter.checkAndIncrement('large:limit', limit, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('should handle special characters in keys', () => {
    const specialKeys = [
      'ip:192.168.1.1',
      'email:user+tag@example.com',
      'key:with:colons',
      'key with spaces',
      'key-with-dashes',
      'key_with_underscores',
      'key.with.dots',
    ];

    specialKeys.forEach(key => {
      const result = rateLimiter.checkAndIncrement(key, 2, 60);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });

    expect(rateLimiter.size()).toBe(specialKeys.length);
  });
});
