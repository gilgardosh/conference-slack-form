/**
 * Email service using Postmark API for sending welcome emails
 */

export interface EmailSuccess {
  ok: true;
}

export interface EmailError {
  ok: false;
  error: string;
}

export type EmailResult = EmailSuccess | EmailError;

export interface WelcomeEmailParams {
  companyName: string;
  email: string;
  channelName: string;
  channelUrl: string;
}

/**
 * Postmark API response interfaces
 */
interface PostmarkResponse {
  MessageID?: string;
  To?: string;
  SubmittedAt?: string;
  ErrorCode?: number;
  Message?: string;
}

/**
 * Email client using Postmark API
 */
export class EmailClient {
  private readonly apiKey: string;
  private readonly fetchFn: typeof fetch;

  constructor(apiKey: string, fetchFn: typeof fetch = fetch) {
    this.apiKey = apiKey;
    this.fetchFn = fetchFn;
  }

  /**
   * Generate HTML template for welcome email
   */
  private generateWelcomeEmailHtml(params: WelcomeEmailParams): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to The Guild Conference Channel</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #0052cc;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
        }
        .content {
            background-color: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 8px 8px;
        }
        .channel-link {
            display: inline-block;
            background-color: #0052cc;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 4px;
            margin: 20px 0;
            font-weight: bold;
        }
        .footer {
            margin-top: 30px;
            font-size: 14px;
            color: #666;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Welcome to The Guild Conference!</h1>
    </div>
    <div class="content">
        <h2>Hi ${this.escapeHtml(params.companyName)}!</h2>
        
        <p>Welcome to The Guild Conference! We're excited to have you join us.</p>
        
        <p>We've created a dedicated Slack channel for your company where you can:</p>
        <ul>
            <li>Connect with our team</li>
            <li>Ask questions about the conference</li>
            <li>Get updates and announcements</li>
            <li>Network with other attendees</li>
        </ul>
        
        <p>Your dedicated channel: <strong>#${this.escapeHtml(params.channelName)}</strong></p>
        
        <p style="text-align: center;">
            <a href="${this.escapeHtml(params.channelUrl)}" class="channel-link">
                Join Your Channel
            </a>
        </p>
        
        <p>If you have any questions or need assistance, feel free to reach out to us in the channel.</p>
        
        <p>Looking forward to seeing you at the conference!</p>
        
        <p>Best regards,<br>
        The Guild Conference Team</p>
    </div>
    <div class="footer">
        <p>This email was sent to you because you registered for The Guild Conference.</p>
    </div>
</body>
</html>`;
  }

  /**
   * Generate plain text version of welcome email
   */
  private generateWelcomeEmailText(params: WelcomeEmailParams): string {
    return `Welcome to The Guild Conference!

Hi ${params.companyName}!

Welcome to The Guild Conference! We're excited to have you join us.

We've created a dedicated Slack channel for your company where you can:
- Connect with our team
- Ask questions about the conference
- Get updates and announcements
- Network with other attendees

Your dedicated channel: #${params.channelName}

Join your channel: ${params.channelUrl}

If you have any questions or need assistance, feel free to reach out to us in the channel.

Looking forward to seeing you at the conference!

Best regards,
The Guild Conference Team

---
This email was sent to you because you registered for The Guild Conference.`;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Sanitize email for logging (show only prefix + domain)
   */
  private sanitizeEmailForLogging(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!domain || !localPart) return '[invalid-email]';

    // Show first 2 characters of local part + *** + domain
    const prefix =
      localPart.length >= 2 ? localPart.substring(0, 2) : localPart;
    return `${prefix}***@${domain}`;
  }

  /**
   * Send welcome email via Postmark API
   */
  public async sendWelcomeEmail(
    params: WelcomeEmailParams
  ): Promise<EmailResult> {
    try {
      const htmlBody = this.generateWelcomeEmailHtml(params);
      const textBody = this.generateWelcomeEmailText(params);

      const postmarkPayload = {
        From: 'noreply@theguild.dev',
        To: params.email,
        Subject: `Welcome to The Guild Conference - Your channel #${params.channelName} is ready!`,
        HtmlBody: htmlBody,
        TextBody: textBody,
        MessageStream: 'outbound',
        Tag: 'conference-welcome',
        Metadata: {
          companyName: params.companyName,
          channelName: params.channelName,
        },
      };

      const response = await this.fetchFn('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': this.apiKey,
        },
        body: JSON.stringify(postmarkPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        try {
          const errorData = JSON.parse(errorText) as PostmarkResponse;
          if (errorData.Message) {
            errorMessage = `${errorMessage} - ${errorData.Message}`;
          }
        } catch {
          // If parsing fails, use the raw text
          if (errorText) {
            errorMessage = `${errorMessage} - ${errorText}`;
          }
        }

        return {
          ok: false,
          error: `Postmark API error: ${errorMessage}`,
        };
      }

      const result = (await response.json()) as PostmarkResponse;

      // Verify we got a message ID indicating success
      if (!result.MessageID) {
        return {
          ok: false,
          error: 'Postmark API response missing MessageID',
        };
      }

      return { ok: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        ok: false,
        error: `Email sending failed: ${errorMessage}`,
      };
    }
  }
}

/**
 * Factory function to create an EmailClient instance
 */
export function createEmailClient(
  apiKey: string,
  fetchFn?: typeof fetch
): EmailClient {
  return new EmailClient(apiKey, fetchFn);
}

/**
 * Main function to send welcome email - matches the interface requested
 */
export async function sendWelcomeEmail(
  params: WelcomeEmailParams,
  apiKey?: string,
  fetchFn?: typeof fetch
): Promise<EmailResult> {
  if (!apiKey) {
    return {
      ok: false,
      error: 'Missing POSTMARK_API_KEY',
    };
  }

  const client = createEmailClient(apiKey, fetchFn);
  return client.sendWelcomeEmail(params);
}
