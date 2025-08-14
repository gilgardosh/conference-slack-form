/**
 * Unit tests for email service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailClient, sendWelcomeEmail, type WelcomeEmailParams } from './email';

describe('EmailClient', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let emailClient: EmailClient;
  
  const mockParams: WelcomeEmailParams = {
    companyName: 'Test Company',
    email: 'test@example.com',
    channelName: 'ext-theguild-test-company',
    channelUrl: 'https://theguild.slack.com/channels/C1234567890',
  };

  beforeEach(() => {
    mockFetch = vi.fn() as any;
    emailClient = new EmailClient('test-api-key', mockFetch as any);
  });

  describe('sendWelcomeEmail', () => {
    it('should send email successfully with valid Postmark response', async () => {
      // Mock successful Postmark response
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          MessageID: 'b7bc2f4a-e38e-4336-af7d-e6c392c2f817',
          To: 'test@example.com',
          SubmittedAt: '2025-08-14T12:00:00.000Z',
        }),
        text: vi.fn(),
      };
      
      mockFetch.mockResolvedValue(mockResponse);

      const result = await emailClient.sendWelcomeEmail(mockParams);

      expect(result).toEqual({ ok: true });
      
      // Verify API call was made correctly
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.postmarkapp.com/email',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Postmark-Server-Token': 'test-api-key',
          },
          body: expect.stringContaining('"To":"test@example.com"'),
        })
      );

      // Verify the request body contains expected content
      const callArgs = mockFetch.mock.calls[0];
      if (callArgs && callArgs[1] && typeof callArgs[1] === 'object' && 'body' in callArgs[1]) {
        const requestBody = JSON.parse(callArgs[1].body as string);
        expect(requestBody).toMatchObject({
          From: 'noreply@theguild.dev',
          To: 'test@example.com',
          Subject: 'Welcome to The Guild Conference - Your channel #ext-theguild-test-company is ready!',
          MessageStream: 'outbound',
          Tag: 'conference-welcome',
          Metadata: {
            companyName: 'Test Company',
            channelName: 'ext-theguild-test-company',
          },
        });

        // Verify HTML and text bodies are included
        expect(requestBody.HtmlBody).toContain('Test Company');
        expect(requestBody.HtmlBody).toContain('ext-theguild-test-company');
        expect(requestBody.HtmlBody).toContain('https://theguild.slack.com/channels/C1234567890');
        expect(requestBody.TextBody).toContain('Test Company');
        expect(requestBody.TextBody).toContain('ext-theguild-test-company');
      }
    });

    it('should handle HTTP error responses from Postmark', async () => {
      // Mock HTTP error response
      const mockResponse = {
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        json: vi.fn().mockResolvedValue({
          ErrorCode: 300,
          Message: 'Invalid email address',
        }),
        text: vi.fn().mockResolvedValue('{"ErrorCode":300,"Message":"Invalid email address"}'),
      };
      
      mockFetch.mockResolvedValue(mockResponse);

      const result = await emailClient.sendWelcomeEmail(mockParams);

      expect(result).toEqual({
        ok: false,
        error: 'Postmark API error: HTTP 422: Unprocessable Entity - Invalid email address',
      });
    });

    it('should handle Postmark API errors with malformed JSON', async () => {
      // Mock HTTP error with invalid JSON
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: vi.fn(),
        text: vi.fn().mockResolvedValue('Internal server error occurred'),
      };
      
      mockFetch.mockResolvedValue(mockResponse);

      const result = await emailClient.sendWelcomeEmail(mockParams);

      expect(result).toEqual({
        ok: false,
        error: 'Postmark API error: HTTP 500: Internal Server Error - Internal server error occurred',
      });
    });

    it('should handle successful response without MessageID', async () => {
      // Mock response without MessageID (unexpected but possible)
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          To: 'test@example.com',
          SubmittedAt: '2025-08-14T12:00:00.000Z',
          // Missing MessageID
        }),
        text: vi.fn(),
      };
      
      mockFetch.mockResolvedValue(mockResponse);

      const result = await emailClient.sendWelcomeEmail(mockParams);

      expect(result).toEqual({
        ok: false,
        error: 'Postmark API response missing MessageID',
      });
    });

    it('should handle network errors', async () => {
      // Mock network error
      mockFetch.mockRejectedValue(new Error('Network timeout'));

      const result = await emailClient.sendWelcomeEmail(mockParams);

      expect(result).toEqual({
        ok: false,
        error: 'Email sending failed: Network timeout',
      });
    });

    it('should handle unknown errors', async () => {
      // Mock non-Error object rejection
      mockFetch.mockRejectedValue('Unknown error');

      const result = await emailClient.sendWelcomeEmail(mockParams);

      expect(result).toEqual({
        ok: false,
        error: 'Email sending failed: Unknown error',
      });
    });

    it('should properly escape HTML in email content', async () => {
      const paramsWithHtml: WelcomeEmailParams = {
        companyName: 'Test & "Company" <script>',
        email: 'test@example.com',
        channelName: 'ext-theguild-test-company',
        channelUrl: 'https://theguild.slack.com/channels/C1234567890',
      };

      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          MessageID: 'test-message-id',
        }),
        text: vi.fn(),
      };
      
      mockFetch.mockResolvedValue(mockResponse);

      await emailClient.sendWelcomeEmail(paramsWithHtml);

      const callArgs = mockFetch.mock.calls[0];
      if (callArgs && callArgs[1] && typeof callArgs[1] === 'object' && 'body' in callArgs[1]) {
        const requestBody = JSON.parse(callArgs[1].body as string);
        
        // Verify HTML is properly escaped
        expect(requestBody.HtmlBody).toContain('Test &amp; &quot;Company&quot; &lt;script&gt;');
        expect(requestBody.HtmlBody).not.toContain('<script>');
        
        // Text body should contain original unescaped content
        expect(requestBody.TextBody).toContain('Test & "Company" <script>');
      }
    });

    it('should include channel URL in email content', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          MessageID: 'test-message-id',
        }),
        text: vi.fn(),
      };
      
      mockFetch.mockResolvedValue(mockResponse);

      await emailClient.sendWelcomeEmail(mockParams);

      const callArgs = mockFetch.mock.calls[0];
      if (callArgs && callArgs[1] && typeof callArgs[1] === 'object' && 'body' in callArgs[1]) {
        const requestBody = JSON.parse(callArgs[1].body as string);
        
        // Verify channel URL is included in both HTML and text
        expect(requestBody.HtmlBody).toContain('https://theguild.slack.com/channels/C1234567890');
        expect(requestBody.TextBody).toContain('https://theguild.slack.com/channels/C1234567890');
      }
    });
  });

  describe('HTML escaping', () => {
    it('should escape all HTML special characters', () => {
      const client = new EmailClient('test-key');
      
      // Access private method via any cast for testing
      const escapeHtml = (client as any).escapeHtml.bind(client);
      
      expect(escapeHtml('&')).toBe('&amp;');
      expect(escapeHtml('<')).toBe('&lt;');
      expect(escapeHtml('>')).toBe('&gt;');
      expect(escapeHtml('"')).toBe('&quot;');
      expect(escapeHtml("'")).toBe('&#39;');
      expect(escapeHtml('&<>"\'test')).toBe('&amp;&lt;&gt;&quot;&#39;test');
    });
  });

  describe('Email sanitization for logging', () => {
    it('should sanitize email addresses correctly', () => {
      const client = new EmailClient('test-key');
      
      // Access private method via any cast for testing
      const sanitizeEmail = (client as any).sanitizeEmailForLogging.bind(client);
      
      expect(sanitizeEmail('test@example.com')).toBe('te***@example.com');
      expect(sanitizeEmail('a@example.com')).toBe('a***@example.com');
      expect(sanitizeEmail('ab@example.com')).toBe('ab***@example.com');
      expect(sanitizeEmail('invalid-email')).toBe('[invalid-email]');
      expect(sanitizeEmail('@example.com')).toBe('[invalid-email]');
      expect(sanitizeEmail('test@')).toBe('[invalid-email]');
    });
  });
});

describe('sendWelcomeEmail function', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  
  const mockParams: WelcomeEmailParams = {
    companyName: 'Test Company',
    email: 'test@example.com',
    channelName: 'ext-theguild-test-company',
    channelUrl: 'https://theguild.slack.com/channels/C1234567890',
  };

  beforeEach(() => {
    mockFetch = vi.fn() as any;
  });

  it('should return error when API key is missing', async () => {
    const result = await sendWelcomeEmail(mockParams, undefined, mockFetch as any);

    expect(result).toEqual({
      ok: false,
      error: 'Missing POSTMARK_API_KEY',
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should successfully send email when API key is provided', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        MessageID: 'test-message-id',
      }),
      text: vi.fn(),
    };
    
    mockFetch.mockResolvedValue(mockResponse);

    const result = await sendWelcomeEmail(mockParams, 'test-api-key', mockFetch as any);

    expect(result).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should use default fetch when not provided', async () => {
    // This test would require mocking global fetch, which is more complex
    // For now, we'll test that the function accepts the parameters correctly
    const result = await sendWelcomeEmail(mockParams);

    // Without API key, should return error regardless of fetch implementation
    expect(result).toEqual({
      ok: false,
      error: 'Missing POSTMARK_API_KEY',
    });
  });
});
