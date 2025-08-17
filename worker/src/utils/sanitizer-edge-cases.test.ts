/**
 * Additional edge case tests for the sanitizer
 */

import { describe, it, expect } from 'vitest';
import { sanitizeCompanyName } from './validation';

describe('Sanitizer Edge Cases', () => {
  it('should handle empty string', () => {
    expect(sanitizeCompanyName('')).toBe('');
  });

  it('should handle only special characters', () => {
    expect(sanitizeCompanyName('!@#$%^&*()')).toBe('');
  });

  it('should handle only whitespace', () => {
    expect(sanitizeCompanyName('   \t\n  ')).toBe('');
  });

  it('should handle Unicode characters', () => {
    expect(sanitizeCompanyName('Café & Résumé')).toBe('cafe-resume');
  });

  it('should handle mixed case with numbers', () => {
    expect(sanitizeCompanyName('Tech123 & Co.')).toBe('tech123-co');
  });

  it('should handle extremely long names', () => {
    const longName = 'a'.repeat(100) + ' corporation';
    const result = sanitizeCompanyName(longName);
    expect(result.length).toBeLessThanOrEqual(80); // Slack channel name limit
  });

  it('should handle consecutive special characters', () => {
    expect(sanitizeCompanyName('Tech!!!---___Company')).toBe('tech-company');
  });

  it('should handle names starting and ending with special chars', () => {
    expect(sanitizeCompanyName('---Tech Company!!!')).toBe('tech-company');
  });

  it('should handle single character', () => {
    expect(sanitizeCompanyName('A')).toBe('a');
  });

  it('should handle all numbers', () => {
    expect(sanitizeCompanyName('123456')).toBe('123456');
  });

  it('should preserve valid hyphens and replace underscores with hyphens', () => {
    expect(sanitizeCompanyName('Tech-Co_Ltd')).toBe('tech-coltd');
  });

  it('should handle international company suffixes', () => {
    expect(sanitizeCompanyName('Tech S.A.R.L.')).toBe('tech-sarl');
  });
});
