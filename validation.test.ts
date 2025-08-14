import { describe, it, expect } from 'vitest';
import { sanitizeCompanyName, isFreeEmailDomain } from './worker/src/utils/validation';

describe('Validation Utils', () => {
  describe('sanitizeCompanyName', () => {
    it('should handle basic sanitization', () => {
      expect(sanitizeCompanyName('Test Company')).toBe('test-company');
    });

    it('should handle empty string', () => {
      expect(sanitizeCompanyName('')).toBe('');
    });

    it('should truncate long names', () => {
      const longName = 'a'.repeat(100);
      const result = sanitizeCompanyName(longName);
      expect(result.length).toBeLessThanOrEqual(67);
    });

    // TODO: Add more comprehensive tests in Milestone 2
    // - Accent removal
    // - Emoji handling
    // - Special character handling
    // - Multiple spaces/dashes
  });

  describe('isFreeEmailDomain', () => {
    it('should detect Gmail as free provider', () => {
      expect(isFreeEmailDomain('user@gmail.com')).toBe(true);
    });

    it('should detect corporate email as non-free', () => {
      expect(isFreeEmailDomain('user@company.com')).toBe(false);
    });

    it('should handle malformed email', () => {
      expect(isFreeEmailDomain('invalid-email')).toBe(false);
    });

    // TODO: Add more comprehensive tests in Milestone 2
    // - More free providers
    // - Case sensitivity
    // - Edge cases
  });
});
