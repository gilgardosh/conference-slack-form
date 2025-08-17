/**
 * Slack Web API wrapper for conference channel management
 */

export interface SlackChannel {
  ok: true;
  channelId: string;
  channelName: string;
}

export interface SlackError {
  ok: false;
  error: string;
  details?: string;
  retryAfter?: number; // For rate limiting
}

export interface SlackLogResult {
  ok: true;
  timestamp: string;
}

export interface SlackInviteResult {
  ok: true;
  invited: boolean;
  details?: string;
}

export type SlackResult<T> = (T & { ok: true }) | SlackError;

/**
 * Slack Web API response interfaces
 */
interface SlackApiResponse {
  ok: boolean;
  error?: string;
}

interface SlackChannelCreateResponse extends SlackApiResponse {
  channel?: {
    id: string;
    name: string;
  };
}

interface SlackConversationInviteResponse extends SlackApiResponse {
  // Slack API response structure for invite
  data?: unknown;
}

interface SlackChatPostMessageResponse extends SlackApiResponse {
  ts?: string; // timestamp
}

/**
 * Slack Web API client
 */
export class SlackClient {
  private readonly token: string;
  private readonly teamId: string;
  private readonly logChannelId: string;
  private readonly fetchFn: typeof fetch = fetch;

  constructor(
    token: string,
    teamId: string,
    logChannelId: string,
    fetchFn?: typeof fetch
  ) {
    this.token = token;
    this.teamId = teamId;
    this.logChannelId = logChannelId;
    this.fetchFn = fetchFn || fetch;
  }

  /**
   * Create a Slack API request
   */
  private async slackRequest<T extends SlackApiResponse>(
    endpoint: string,
    body: Record<string, unknown>
  ): Promise<T | SlackError> {
    try {
      const fetch = this.fetchFn;
      const response = await fetch(`https://slack.com/api/${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = parseInt(
          response.headers.get('Retry-After') || '60'
        );
        return {
          ok: false,
          error: 'rate_limited',
          details: 'Slack API rate limit exceeded',
          retryAfter,
        };
      }

      if (!response.ok) {
        return {
          ok: false,
          error: 'http_error',
          details: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = (await response.json()) as T;

      if (!data.ok) {
        return {
          ok: false,
          error: data.error || 'unknown_error',
          details: 'Slack API returned an error',
        };
      }

      return data;
    } catch (error) {
      return {
        ok: false,
        error: 'network_error',
        details:
          error instanceof Error ? error.message : 'Unknown network error',
      };
    }
  }

  /**
   * Create a channel name from sanitized company name
   */
  public createChannelName(sanitizedCompanyName: string): string {
    return `ext-theguild-${sanitizedCompanyName}`;
  }

  /**
   * Create a channel with automatic name collision handling
   */
  public async createChannel(
    sanitizedName: string
  ): Promise<SlackResult<SlackChannel>> {
    const baseChannelName = this.createChannelName(sanitizedName);
    let attemptCount = 0;
    const maxAttempts = 10;

    while (attemptCount < maxAttempts) {
      const channelName =
        attemptCount === 0
          ? baseChannelName
          : `${baseChannelName}-${attemptCount + 1}`;

      const result = await this.slackRequest<SlackChannelCreateResponse>(
        'conversations.create',
        {
          name: channelName,
          is_private: false,
        }
      );

      // Handle errors
      if ('error' in result) {
        // If it's a name collision, try the next variant
        if (result.error === 'name_taken') {
          attemptCount++;
          continue;
        }

        // For other errors, return immediately
        return result as SlackError;
      }

      // Success! Return the channel info
      if (result.channel) {
        return {
          ok: true,
          channelId: result.channel.id,
          channelName: result.channel.name,
        };
      }

      // Unexpected response structure
      return {
        ok: false,
        error: 'invalid_response',
        details:
          'Channel creation succeeded but response format was unexpected',
      };
    }

    // Exhausted all attempts
    return {
      ok: false,
      error: 'max_attempts_exceeded',
      details: `Failed to create channel after ${maxAttempts} attempts due to name collisions`,
    };
  }

  /**
   * Invite the configured guild group to a channel
   */
  public async inviteGroup(
    channelId: string
  ): Promise<SlackResult<SlackInviteResult>> {
    const result = await this.slackRequest<SlackConversationInviteResponse>(
      'conversations.invite',
      {
        channel: channelId,
        users: this.teamId,
      }
    );

    if ('error' in result) {
      return result as SlackError;
    }

    return {
      ok: true,
      invited: true,
      details: 'Guild group invited to channel',
    };
  }

  /**
   * Create a single-channel guest invite for an email
   * Note: This simulates the expected API call. In production, this might require
   * admin API access and specific scopes like admin.invites:write
   */
  public async inviteGuest(
    email: string,
    channelId: string
  ): Promise<SlackResult<SlackInviteResult>> {
    // Note: The actual Slack API for guest invites may require different endpoints
    // This is a simulation based on common patterns. Real implementation might use:
    // - admin.invites.send for workspace invites
    // - admin.users.invite for single-channel guests
    // Required scopes: admin.invites:write, admin.users:write

    const result = await this.slackRequest<SlackApiResponse>(
      'admin.users.invite',
      {
        email,
        channel_ids: [channelId],
        guest_expiration_ts: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
        is_restricted: true, // Single channel guest
        is_ultra_restricted: false,
      }
    );

    if ('error' in result) {
      return result as SlackError;
    }

    return {
      ok: true,
      invited: true,
      details: `Guest invite sent to ${email} for channel ${channelId}`,
    };
  }

  /**
   * Log a message to the configured log channel
   */
  public async logToChannel(
    message: string,
    level: 'info' | 'warn' | 'error' = 'info'
  ): Promise<SlackResult<SlackLogResult>> {
    const emoji = {
      info: ':information_source:',
      warn: ':warning:',
      error: ':exclamation:',
    };

    const formattedMessage = `${emoji[level]} *[${level.toUpperCase()}]* ${message}`;

    const result = await this.slackRequest<SlackChatPostMessageResponse>(
      'chat.postMessage',
      {
        channel: this.logChannelId,
        text: formattedMessage,
        unfurl_links: false,
        unfurl_media: false,
      }
    );

    if ('error' in result) {
      return result as SlackError;
    }

    return {
      ok: true,
      timestamp: result.ts || new Date().toISOString(),
    };
  }
}

/**
 * Factory function to create a SlackClient instance
 */
export function createSlackClient(
  token: string,
  teamId: string,
  logChannelId: string,
  fetchFn?: typeof fetch
): SlackClient {
  return new SlackClient(token, teamId, logChannelId, fetchFn);
}
