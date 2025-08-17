/**
 * Unit tests for Slack client
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SlackClient, createSlackClient } from './slack';

// Mock fetch function
const createMockFetch = () => {
  const mockFetch = vi.fn();
  return mockFetch;
};

describe('SlackClient', () => {
  let slackClient: SlackClient;
  let mockFetch: ReturnType<typeof createMockFetch>;
  
  const TEST_TOKEN = 'xoxb-test-token';
  const TEST_TEAM_ID = 'S1234567890';
  const TEST_LOG_CHANNEL = 'C1234567890';

  beforeEach(() => {
    mockFetch = createMockFetch();
    slackClient = new SlackClient(TEST_TOKEN, TEST_TEAM_ID, TEST_LOG_CHANNEL, mockFetch);
  });

  describe('createChannelName', () => {
    it('should create correct channel name pattern', () => {
      const result = slackClient.createChannelName('mycompany');
      expect(result).toBe('ext-theguild-mycompany');
    });

    it('should handle sanitized names with special characters removed', () => {
      const result = slackClient.createChannelName('my-company-123');
      expect(result).toBe('ext-theguild-my-company-123');
    });
  });

  describe('createChannel', () => {
    it('should create channel successfully on first attempt', async () => {
      const mockResponse = {
        ok: true,
        channel: {
          id: 'C1234567890',
          name: 'ext-theguild-testcompany'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: () => Promise.resolve(mockResponse)
      });

      const result = await slackClient.createChannel('testcompany');

      expect(result).toEqual({
        ok: true,
        channelId: 'C1234567890',
        channelName: 'ext-theguild-testcompany'
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://slack.com/api/conversations.create',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${TEST_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: 'ext-theguild-testcompany',
            is_private: false
          })
        }
      );
    });

    it('should handle name collisions and retry with incremented names', async () => {
      // First call: name collision
      const nameCollisionResponse = {
        ok: false,
        error: 'name_taken'
      };

      // Second call: success
      const successResponse = {
        ok: true,
        channel: {
          id: 'C1234567890',
          name: 'ext-theguild-testcompany-2'
        }
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: () => Promise.resolve(nameCollisionResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: () => Promise.resolve(successResponse)
        });

      const result = await slackClient.createChannel('testcompany');

      expect(result).toEqual({
        ok: true,
        channelId: 'C1234567890',
        channelName: 'ext-theguild-testcompany-2'
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      // First call with original name
      expect(mockFetch).toHaveBeenNthCalledWith(1,
        'https://slack.com/api/conversations.create',
        expect.objectContaining({
          body: JSON.stringify({
            name: 'ext-theguild-testcompany',
            is_private: false
          })
        })
      );

      // Second call with incremented name
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'https://slack.com/api/conversations.create',
        expect.objectContaining({
          body: JSON.stringify({
            name: 'ext-theguild-testcompany-2',
            is_private: false
          })
        })
      );
    });

    it('should fail after maximum attempts due to name collisions', async () => {
      const nameCollisionResponse = {
        ok: false,
        error: 'name_taken'
      };

      // Mock 10 consecutive name collisions
      for (let i = 0; i < 10; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: () => Promise.resolve(nameCollisionResponse)
        });
      }

      const result = await slackClient.createChannel('testcompany');

      expect(result).toEqual({
        ok: false,
        error: 'max_attempts_exceeded',
        details: 'Failed to create channel after 10 attempts due to name collisions'
      });

      expect(mockFetch).toHaveBeenCalledTimes(10);
    });

    it('should handle rate limiting properly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: (name: string) => name === 'Retry-After' ? '120' : null },
        json: () => Promise.resolve({})
      });

      const result = await slackClient.createChannel('testcompany');

      expect(result).toEqual({
        ok: false,
        error: 'rate_limited',
        details: 'Slack API rate limit exceeded',
        retryAfter: 120
      });
    });

    it('should handle other Slack API errors immediately', async () => {
      const errorResponse = {
        ok: false,
        error: 'invalid_auth'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: () => Promise.resolve(errorResponse)
      });

      const result = await slackClient.createChannel('testcompany');

      expect(result).toEqual({
        ok: false,
        error: 'invalid_auth',
        details: 'Slack API returned an error'
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('inviteGroup', () => {
    it('should invite group successfully', async () => {
      const mockResponse = {
        ok: true
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: () => Promise.resolve(mockResponse)
      });

      const result = await slackClient.inviteGroup('C1234567890');

      expect(result).toEqual({
        ok: true,
        invited: true,
        details: 'Guild group invited to channel'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://slack.com/api/conversations.invite',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${TEST_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            channel: 'C1234567890',
            users: TEST_TEAM_ID
          })
        }
      );
    });

    it('should handle invite failures', async () => {
      const errorResponse = {
        ok: false,
        error: 'channel_not_found'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: () => Promise.resolve(errorResponse)
      });

      const result = await slackClient.inviteGroup('C1234567890');

      expect(result).toEqual({
        ok: false,
        error: 'channel_not_found',
        details: 'Slack API returned an error'
      });
    });
  });

  describe('inviteGuest', () => {
    it('should invite guest successfully', async () => {
      const mockResponse = {
        ok: true,
        invite_id: 'I1234567890',
        is_legacy_shared_channel: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: () => Promise.resolve(mockResponse),
      });

      const result = await slackClient.inviteGuest(
        'test@example.com',
        'C1234567890'
      );

      expect(result).toEqual({
        ok: true,
        invited: true,
        details: 'Guest invite sent to test@example.com for channel C1234567890',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://slack.com/api/conversations.inviteShared',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TEST_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel: 'C1234567890',
            emails: ['test@example.com'],
          }),
        }
      );
    });

    it('should handle guest invite failures', async () => {
      const errorResponse = {
        ok: false,
        error: 'email_already_exists'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: () => Promise.resolve(errorResponse)
      });

      const result = await slackClient.inviteGuest('test@example.com', 'C1234567890');

      expect(result).toEqual({
        ok: false,
        error: 'email_already_exists',
        details: 'Slack API returned an error'
      });
    });
  });

  describe('logToChannel', () => {
    it('should log info message successfully', async () => {
      const mockResponse = {
        ok: true,
        ts: '1234567890.123456'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: () => Promise.resolve(mockResponse)
      });

      const result = await slackClient.logToChannel('Test message', 'info');

      expect(result).toEqual({
        ok: true,
        timestamp: '1234567890.123456'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${TEST_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            channel: TEST_LOG_CHANNEL,
            text: ':information_source: *[INFO]* Test message',
            unfurl_links: false,
            unfurl_media: false
          })
        }
      );
    });

    it('should format warning messages correctly', async () => {
      const mockResponse = {
        ok: true,
        ts: '1234567890.123456'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: () => Promise.resolve(mockResponse)
      });

      await slackClient.logToChannel('Test warning', 'warn');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.objectContaining({
          body: JSON.stringify({
            channel: TEST_LOG_CHANNEL,
            text: ':warning: *[WARN]* Test warning',
            unfurl_links: false,
            unfurl_media: false
          })
        })
      );
    });

    it('should format error messages correctly', async () => {
      const mockResponse = {
        ok: true,
        ts: '1234567890.123456'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: () => Promise.resolve(mockResponse)
      });

      await slackClient.logToChannel('Test error', 'error');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.objectContaining({
          body: JSON.stringify({
            channel: TEST_LOG_CHANNEL,
            text: ':exclamation: *[ERROR]* Test error',
            unfurl_links: false,
            unfurl_media: false
          })
        })
      );
    });

    it('should handle log failures', async () => {
      const errorResponse = {
        ok: false,
        error: 'channel_not_found'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: () => Promise.resolve(errorResponse)
      });

      const result = await slackClient.logToChannel('Test message');

      expect(result).toEqual({
        ok: false,
        error: 'channel_not_found',
        details: 'Slack API returned an error'
      });
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await slackClient.createChannel('testcompany');

      expect(result).toEqual({
        ok: false,
        error: 'network_error',
        details: 'Network error'
      });
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: { get: () => null }
      });

      const result = await slackClient.createChannel('testcompany');

      expect(result).toEqual({
        ok: false,
        error: 'http_error',
        details: 'HTTP 500: Internal Server Error'
      });
    });
  });

  describe('createSlackClient factory', () => {
    it('should create client instance with correct parameters', () => {
      const client = createSlackClient(TEST_TOKEN, TEST_TEAM_ID, TEST_LOG_CHANNEL);
      expect(client).toBeInstanceOf(SlackClient);
    });

    it('should create client instance with custom fetch function', () => {
      const customFetch = vi.fn();
      const client = createSlackClient(TEST_TOKEN, TEST_TEAM_ID, TEST_LOG_CHANNEL, customFetch);
      expect(client).toBeInstanceOf(SlackClient);
    });
  });
});
