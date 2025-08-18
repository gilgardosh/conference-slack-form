# Email Service Documentation

The email service provides functionality to send welcome emails using the Postmark API. This service is designed to work seamlessly with the Slack integration for the conference form application.

## Features

- **Postmark API Integration**: Direct HTTP calls to Postmark's email sending endpoint
- **HTML & Text Templates**: Built-in email templates with both HTML and plain text versions
- **PII Protection**: Email addresses are sanitized in logs for privacy protection
- **Error Handling**: Comprehensive error handling with no automatic retries
- **Testing**: Full unit test coverage with mocked HTTP requests

## Basic Usage

### Simple Email Sending

```typescript
import { sendWelcomeEmail } from './lib/email';

const result = await sendWelcomeEmail(
  {
    companyName: 'Acme Corp',
    email: 'contact@acme.com',
    channelName: 'ext-theguild-acme-corp',
    channelUrl: 'https://theguild.slack.com/channels/C1234567890',
  },
  env.POSTMARK_API_KEY
);

if (result.ok) {
  console.log('Email sent successfully');
} else {
  console.error('Email failed:', result.error);
  // Log to Slack for visibility
  await slackClient.logToChannel(
    `Email sending failed: ${result.error}`,
    'error'
  );
}
```

### Using the EmailClient Class

```typescript
import { EmailClient } from './lib/email';

const emailClient = new EmailClient(env.POSTMARK_API_KEY);

const result = await emailClient.sendWelcomeEmail({
  companyName: 'Acme Corp',
  email: 'contact@acme.com',
  channelName: 'ext-theguild-acme-corp',
  channelUrl: 'https://theguild.slack.com/channels/C1234567890',
});
```

## Integration with Slack

The email service is designed to work with the existing Slack functionality:

```typescript
import { createSlackClient } from './lib/slack';
import { sendWelcomeEmail } from './lib/email';

// 1. Create Slack channel
const slackClient = createSlackClient(
  env.SLACK_BOT_TOKEN,
  env.SLACK_TEAM_ID,
  env.SLACK_LOG_CHANNEL_ID
);
const channelResult = await slackClient.createChannel(sanitizedCompanyName);

if (channelResult.ok) {
  // 2. Send welcome email
  const emailResult = await sendWelcomeEmail(
    {
      companyName: originalCompanyName,
      email: userEmail,
      channelName: channelResult.channelName,
      channelUrl: `https://theguild.slack.com/channels/${channelResult.channelId}`,
    },
    env.POSTMARK_API_KEY
  );

  if (!emailResult.ok) {
    // 3. Log failures to Slack
    await slackClient.logToChannel(
      `Email sending failed for company "${originalCompanyName}": ${emailResult.error}`,
      'error'
    );
  }
}
```

## Environment Variables

The email service requires the following environment variable:

- `POSTMARK_API_KEY`: Your Postmark server API token

## Email Template

The service includes a built-in HTML template with:

- Professional design with The Guild branding
- Company name personalization
- Channel information and direct link
- Responsive design for mobile devices
- Both HTML and plain text versions

### Template Features

- **HTML Escaping**: All user input is properly escaped to prevent XSS
- **Channel Links**: Direct links to the created Slack channel
- **Professional Styling**: Clean, modern design with proper typography
- **Mobile Responsive**: Works well on all device sizes

## Privacy & Security

### PII Protection

Email addresses are automatically sanitized in logs:

```typescript
// Original: user@company.com
// Logged as: us***@company.com
```

### No Sensitive Data in Logs

- Only sanitized email addresses appear in logs
- Full email addresses are never logged
- Error messages exclude sensitive information

## Error Handling

The service returns structured error responses:

```typescript
type EmailResult = { ok: true } | { ok: false; error: string };
```

### Common Error Scenarios

1. **Missing API Key**: Returns `{ok: false, error: "Missing POSTMARK_API_KEY"}`
2. **Network Errors**: Returns `{ok: false, error: "Email sending failed: [details]"}`
3. **Postmark API Errors**: Returns `{ok: false, error: "Postmark API error: [details]"}`
4. **Invalid Response**: Returns `{ok: false, error: "Postmark API response missing MessageID"}`

### No Automatic Retries

The service does **not** implement automatic retries. If an email fails:

1. The service returns an error immediately
2. The caller should log the error to Slack
3. Manual intervention may be required for resolution

## Testing

The email service includes comprehensive unit tests:

```bash
# Run email service tests
yarn test src/lib/email.test.ts

# Run integration tests
yarn test src/lib/email-integration.test.ts

# Run all tests
yarn test
```

### Test Coverage

- ✅ Successful email sending
- ✅ HTTP error responses from Postmark
- ✅ Malformed JSON responses
- ✅ Missing MessageID in success response
- ✅ Network errors
- ✅ HTML escaping
- ✅ Email sanitization for logging
- ✅ Integration with Slack logging

## Postmark API Details

The service sends emails using Postmark's `/email` endpoint with:

- **From**: `noreply@theguild.dev`
- **Subject**: Dynamic based on channel name
- **Message Stream**: `outbound`
- **Tag**: `conference-welcome`
- **Metadata**: Company name and channel name for tracking

### Required Headers

- `Accept: application/json`
- `Content-Type: application/json`
- `X-Postmark-Server-Token: [API_KEY]`

## Future Enhancements

The current implementation uses inline templates. Future versions may support:

- Postmark template system integration
- Multiple email templates
- Email personalization tokens
- Delivery tracking and webhooks
