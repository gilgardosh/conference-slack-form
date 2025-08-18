import { describe, it, expect } from 'vitest';
import {
  sanitizeCompanyName,
  isFreeEmailDomain,
  validateAndSanitize,
  validateAndSanitizePreview,
} from './validation';

describe('sanitizeCompanyName', () => {
  it('converts to lowercase', () => {
    expect(sanitizeCompanyName('ACME Corp')).toBe('acme-corp');
  });

  it('converts accents to ASCII', () => {
    expect(sanitizeCompanyName('Café')).toBe('cafe');
    expect(sanitizeCompanyName('Naïve Inc')).toBe('naive-inc');
    expect(sanitizeCompanyName('Zürich AG')).toBe('zurich-ag');
    expect(sanitizeCompanyName('Ñoño Corp')).toBe('nono-corp');
  });

  it('removes emojis and symbols', () => {
    expect(sanitizeCompanyName('acme 🚀!')).toBe('acme');
    expect(sanitizeCompanyName('tech@corp$')).toBe('techcorp');
    expect(sanitizeCompanyName('company★★★')).toBe('company');
    expect(sanitizeCompanyName('test (inc.)')).toBe('test-inc');
  });

  it('converts spaces to dashes and collapses multiple dashes', () => {
    expect(sanitizeCompanyName('acme corp')).toBe('acme-corp');
    expect(sanitizeCompanyName('acme   corp')).toBe('acme-corp');
    expect(sanitizeCompanyName('acme -- corp')).toBe('acme-corp');
    expect(sanitizeCompanyName('acme - - corp')).toBe('acme-corp');
  });

  it('trims leading and trailing dashes', () => {
    expect(sanitizeCompanyName('-acme-')).toBe('acme');
    expect(sanitizeCompanyName('--acme--')).toBe('acme');
    expect(sanitizeCompanyName('   -acme-   ')).toBe('acme');
  });

  it('truncates to 67 characters', () => {
    const longName = 'a'.repeat(100);
    expect(sanitizeCompanyName(longName)).toBe('a'.repeat(67));

    const longNameWithDashes =
      'very-long-company-name-that-exceeds-sixty-seven-characters-limit-test';
    expect(sanitizeCompanyName(longNameWithDashes).length).toBe(67);
  });

  it('handles complex cases', () => {
    expect(sanitizeCompanyName('  Café 🚀 & Associates Inc.  ')).toBe(
      'cafe-associates-inc'
    );
    expect(sanitizeCompanyName('Zürich (Naïve) Corp★')).toBe(
      'zurich-naive-corp'
    );
  });

  it('returns empty string for input with no valid characters', () => {
    expect(sanitizeCompanyName('')).toBe('');
    expect(sanitizeCompanyName('🚀🌟✨')).toBe('');
    expect(sanitizeCompanyName('!@#$%^&*()')).toBe('');
    expect(sanitizeCompanyName('   ')).toBe('');
  });
});

describe('isFreeEmailDomain', () => {
  it('identifies common free email providers', () => {
    expect(isFreeEmailDomain('user@gmail.com')).toBe(true);
    expect(isFreeEmailDomain('user@yahoo.com')).toBe(true);
    expect(isFreeEmailDomain('user@hotmail.com')).toBe(true);
    expect(isFreeEmailDomain('user@outlook.com')).toBe(true);
    expect(isFreeEmailDomain('user@aol.com')).toBe(true);
    expect(isFreeEmailDomain('user@icloud.com')).toBe(true);
    expect(isFreeEmailDomain('user@protonmail.com')).toBe(true);
  });

  it('is case insensitive', () => {
    expect(isFreeEmailDomain('user@GMAIL.COM')).toBe(true);
    expect(isFreeEmailDomain('user@Gmail.Com')).toBe(true);
  });

  it('returns false for business domains', () => {
    expect(isFreeEmailDomain('user@company.com')).toBe(false);
    expect(isFreeEmailDomain('user@acme.org')).toBe(false);
    expect(isFreeEmailDomain('user@example.net')).toBe(false);
  });

  it('handles invalid email formats gracefully', () => {
    expect(isFreeEmailDomain('invalid-email')).toBe(false);
    expect(isFreeEmailDomain('user@')).toBe(false);
    expect(isFreeEmailDomain('@gmail.com')).toBe(false);
  });
});

describe('validateAndSanitize', () => {
  it('validates and sanitizes valid input', () => {
    const input = {
      companyName: 'Café Corp',
      email: 'user@example.com',
    };

    const result = validateAndSanitize(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.companyName).toBe('Café Corp');
      expect(result.value.email).toBe('user@example.com');
      expect(result.value.sanitizedCompanyName).toBe('cafe-corp');
    }
  });

  it('validates complex company name sanitization', () => {
    const input = {
      companyName: 'Café 🚀!',
      email: 'user@example.com',
    };

    const result = validateAndSanitize(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sanitizedCompanyName).toBe('cafe');
    }
  });

  it('returns errors for missing company name', () => {
    const input = {
      email: 'user@example.com',
    };

    const result = validateAndSanitize(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain('companyName: Required');
    }
  });

  it('returns errors for empty company name', () => {
    const input = {
      companyName: '',
      email: 'user@example.com',
    };

    const result = validateAndSanitize(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some(error => error.includes('Company name is required'))
      ).toBe(true);
    }
  });

  it('returns errors for missing email', () => {
    const input = {
      companyName: 'ACME Corp',
    };

    const result = validateAndSanitize(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain('email: Required');
    }
  });

  it('returns errors for invalid email format', () => {
    const input = {
      companyName: 'ACME Corp',
      email: 'invalid-email',
    };

    const result = validateAndSanitize(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some(error => error.includes('Invalid email format'))
      ).toBe(true);
    }
  });

  it('returns errors for company name with no valid characters', () => {
    const input = {
      companyName: '🚀🌟✨',
      email: 'user@example.com',
    };

    const result = validateAndSanitize(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain(
        'Company name contains no valid characters after sanitization'
      );
    }
  });

  it('handles multiple validation errors', () => {
    const input = {
      companyName: '',
      email: 'invalid-email',
    };

    const result = validateAndSanitize(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(1);
    }
  });

  it('handles non-object input', () => {
    const result = validateAndSanitize('invalid');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('handles null input', () => {
    const result = validateAndSanitize(null);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});

describe('validateAndSanitizePreview', () => {
  it('validates and sanitizes with only company name', () => {
    const input = {
      companyName: 'ACME Corp',
    };

    const result = validateAndSanitizePreview(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.companyName).toBe('ACME Corp');
      expect(result.value.email).toBe('');
      expect(result.value.sanitizedCompanyName).toBe('acme-corp');
    }
  });

  it('rejects input without company name', () => {
    const input = {
      email: 'test@example.com',
    };

    const result = validateAndSanitizePreview(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain('companyName: Required');
    }
  });

  it('rejects empty company name', () => {
    const input = {
      companyName: '',
    };

    const result = validateAndSanitizePreview(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain('companyName: Company name is required');
    }
  });

  it('rejects company name that becomes empty after sanitization', () => {
    const input = {
      companyName: '🎉🎊!!!',
    };

    const result = validateAndSanitizePreview(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain(
        'Company name contains no valid characters after sanitization'
      );
    }
  });

  it('handles complex company name sanitization', () => {
    const input = {
      companyName: '  Café 🚀 & Associates Inc.  ',
    };

    const result = validateAndSanitizePreview(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.companyName).toBe('  Café 🚀 & Associates Inc.  ');
      expect(result.value.sanitizedCompanyName).toBe('cafe-associates-inc');
    }
  });
});
