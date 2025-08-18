# Deployment Guide

This document outlines how to deploy and configure the Conference Slack Form application.

## Prerequisites

- Node.js 18+ installed
- Wrangler CLI installed (`yarn install -g wrangler`)
- Cloudflare account with Workers enabled
- Slack workspace with admin access
- Postmark account for email sending

## Environment Variables

The following environment variables must be configured in Cloudflare:

### Required Variables

| Variable                | Description                                      | Example                     |
| ----------------------- | ------------------------------------------------ | --------------------------- |
| `SLACK_BOT_TOKEN`       | Slack Bot User OAuth Token (starts with `xoxb-`) | `xoxb-1234567890-abcdef...` |
| `SLACK_TEAM_ID`         | Your Slack workspace/team ID                     | `T1234567890`               |
| `SLACK_LOG_CHANNEL_ID`  | Channel ID for logging events                    | `C1234567890`               |
| `POSTMARK_API_KEY`      | Postmark server API key                          | `your-postmark-key`         |
| `RATE_LIMIT`            | Maximum submissions per window per IP/email      | `5`                         |
| `RATE_LIMIT_WINDOW_SEC` | Rate limit window duration in seconds            | `3600`                      |

## Deployment Steps

### 1. Build the Client Application

```bash
cd client
yarn install
yarn build
```

### 2. Deploy the Worker

```bash
cd worker
yarn install

# For production deployment
npx wrangler deploy

# For development deployment
npx wrangler deploy --env development
```

### 3. Set Environment Variables in Cloudflare

Use Wrangler CLI to set the required secrets:

```bash
# Set each environment variable as a secret
npx wrangler secret put SLACK_BOT_TOKEN
npx wrangler secret put SLACK_TEAM_ID
npx wrangler secret put SLACK_LOG_CHANNEL_ID
npx wrangler secret put POSTMARK_API_KEY
npx wrangler secret put RATE_LIMIT
npx wrangler secret put RATE_LIMIT_WINDOW_SEC
```

Alternatively, set variables through the Cloudflare Dashboard:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to Workers & Pages
3. Select your worker
4. Go to Settings → Variables
5. Add each variable under "Environment Variables" (encrypted)

### 4. Configure Client for Production

Create a production environment file:

```bash
# client/.env.production
VITE_API_BASE_URL=https://your-worker-subdomain.your-account.workers.dev
```

Or set the environment variable during build:

```bash
cd client
VITE_API_BASE_URL=https://your-worker-subdomain.your-account.workers.dev yarn build
```

### 5. Verify Deployment

1. Visit your Worker URL
2. Test form submission with valid data
3. Check Slack for new channel creation
4. Verify email delivery via Postmark
5. Check logs in designated Slack channel

## Rate Limiter Limitations

⚠️ **Important**: The current rate limiter implementation has these limitations:

### Single-Instance Memory Storage

- Rate limit data is stored **in-memory per Worker instance**
- Multiple Worker instances (due to geographic distribution or scaling) maintain **separate rate limit counters**
- This means the effective rate limit may be higher than configured in high-traffic scenarios

### No Persistence

- Rate limit data is **lost on Worker restart or deployment**
- Cold starts reset all rate limit counters
- No historical rate limit data is maintained

### Recommended Improvements for Production

For production environments with strict rate limiting requirements, consider:

1. **Durable Objects**: Use Cloudflare Durable Objects for centralized, persistent rate limiting
2. **External Storage**: Integrate with Redis or similar for shared rate limit state
3. **KV Storage**: Use Cloudflare KV for simple persistent counters (with eventual consistency trade-offs)

The current implementation is suitable for:

- Development and testing environments
- Low to moderate traffic scenarios
- Basic abuse prevention

## Rollback Plan

### Quick Disable (Emergency)

If you need to quickly disable the Worker:

1. **Via Wrangler CLI:**

   ```bash
   npx wrangler delete
   ```

2. **Via Cloudflare Dashboard:**
   - Go to Workers & Pages
   - Select your worker
   - Click "Delete" or "Disable"

3. **Route Disabling:**
   - Remove custom domain routes if configured
   - Traffic will return 404 instead of reaching the Worker

### Gradual Rollback

For a more controlled rollback:

1. **Deploy Previous Version:**

   ```bash
   # If you have a previous version in git
   git checkout <previous-version-tag>
   cd worker
   npx wrangler deploy
   ```

2. **Feature Flags:**
   - Add a `MAINTENANCE_MODE` environment variable
   - Update Worker to show maintenance page when enabled
   - Set via: `npx wrangler secret put MAINTENANCE_MODE --text "true"`

3. **DNS Changes:**
   - If using custom domains, update DNS to point away from Worker
   - Changes may take up to 24 hours to propagate globally

## Monitoring and Maintenance

### Health Checks

- Monitor Worker logs in Cloudflare Dashboard
- Set up alerts for error rates in designated Slack channel
- Check Postmark delivery statistics regularly

### Regular Maintenance

- Update dependencies monthly
- Review and rotate API tokens quarterly
- Monitor rate limit effectiveness and adjust as needed
- Test disaster recovery procedures

### Scaling Considerations

- Workers automatically scale with traffic
- Consider upgrading to paid plan for higher limits
- Monitor CPU time and memory usage in Cloudflare analytics

## Troubleshooting

### Common Issues

1. **Form submissions fail with 500 errors:**
   - Check Worker logs for specific error messages
   - Verify all environment variables are set correctly
   - Test Slack and Postmark API credentials

2. **Rate limiting not working as expected:**
   - Remember the single-instance limitation
   - Check rate limit configuration values
   - Consider implementing centralized rate limiting for production

3. **Emails not sending:**
   - Verify Postmark API key and sender domain
   - Check Postmark activity logs
   - Ensure email template is properly configured

4. **Slack integration failures:**
   - Verify bot token has required scopes
   - Check if bot is installed in the workspace
   - Ensure target channels exist and bot has access

### Support Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [Slack API Documentation](https://api.slack.com/)
- [Postmark API Documentation](https://postmarkapp.com/developer)
