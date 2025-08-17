import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sanitizePreview, isValidEmail, isValidCompanyName } from './utils';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('sanitizePreview', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should call the sanitize-preview endpoint and return the response', async () => {
    const mockResponse = {
      ok: true,
      sanitizedCompanyName: 'test-company',
    };

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse),
    });

    const formData = { companyName: 'Test Company!', email: 'test@example.com' };
    const result = await sanitizePreview(formData);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8787/api/sanitize-preview',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      }
    );

    expect(result).toEqual(mockResponse);
  });

  it('should handle fetch errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const formData = { companyName: 'Test Company', email: 'test@example.com' };
    
    await expect(sanitizePreview(formData)).rejects.toThrow('Network error');
  });
});

describe('isValidEmail', () => {
  it('should return true for valid emails', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
  });

  it('should return false for invalid emails', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('test@')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
    expect(isValidEmail('test@example')).toBe(false);
  });
});

describe('isValidCompanyName', () => {
  it('should return true for valid company names', () => {
    expect(isValidCompanyName('Valid Company')).toBe(true);
    expect(isValidCompanyName('A')).toBe(true);
    expect(isValidCompanyName('A'.repeat(67))).toBe(true);
  });

  it('should return false for invalid company names', () => {
    expect(isValidCompanyName('')).toBe(false);
    expect(isValidCompanyName('   ')).toBe(false);
    expect(isValidCompanyName('A'.repeat(68))).toBe(false);
  });
});
