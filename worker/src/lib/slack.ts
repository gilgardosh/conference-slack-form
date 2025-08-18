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

export interface SlackGroupUsersResult {
  ok: true;
  users: string[];
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

interface SlackGroupUsersResponse extends SlackApiResponse {
  // Slack API response structure for group users
  users?: string[];
}

interface SlackInviteSharedResponse extends SlackApiResponse {
  invite_id?: string;
  is_legacy_shared_channel?: boolean;
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
    body: Record<string, unknown>,
    method: 'GET' | 'POST' = 'POST'
  ): Promise<T | SlackError> {
    try {
      const url = new URL(`https://slack.com/api/${endpoint}`);
      if (method === 'GET') {
        Object.entries(body).forEach(([key, value]) => {
          url.searchParams.append(key, String(value));
        });
      }
      const fetch = this.fetchFn;
      const requestContent: RequestInit =
        method === 'GET'
          ? {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${this.token}`,
                'Content-Type': 'application/json',
              },
            }
          : {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${this.token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(body),
            };
      const response = await fetch(url.toString(), requestContent);

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
    channelId: string,
    users: string[]
  ): Promise<SlackResult<SlackInviteResult>> {
    const result = await this.slackRequest<SlackConversationInviteResponse>(
      'conversations.invite',
      {
        channel: channelId,
        users: users.join(','),
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
   * Get the list of users in the configured guild group
   */
  public async getGroupUsers(): Promise<SlackResult<SlackGroupUsersResult>> {
    const result = await this.slackRequest<SlackGroupUsersResponse>(
      'usergroups.users.list',
      {
        usergroup: this.teamId,
      },
      'GET'
    );

    if ('error' in result) {
      return result as SlackError;
    }

    return {
      ok: true,
      users: result.users || [],
      details: 'Guild group users retrieved successfully',
    };
  }

  /**
   * Create a single-channel guest invite for an email using conversations.inviteShared
   */
  public async inviteGuest(
    email: string,
    channelId: string
  ): Promise<SlackResult<SlackInviteResult>> {
    // Note: This uses the conversations.inviteShared endpoint to invite an external user
    // to a single channel via email. This is part of the Slack Connect feature.
    // Required scopes: conversations.connect:write

    const result = await this.slackRequest<SlackInviteSharedResponse>(
      'conversations.inviteShared',
      {
        channel: channelId,
        emails: [email],
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
