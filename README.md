# Conference Slack Channel Form App

A React single-page application served via Cloudflare Worker that enables conference attendees to submit their company information and automatically get invited to a dedicated Slack channel.

## Features

- 🚀 **Serverless Architecture**: Fully hosted on Cloudflare Workers
- ⚡ **React SPA**: Modern TypeScript React application with Tailwind CSS
- 🔗 **Slack Integration**: Automatic channel creation and guest invitations
- 📧 **Email Notifications**: Custom branded emails via Postmark
- 🌙 **Dark Mode**: Built-in dark mode support
- 📱 **Responsive**: Mobile-first responsive design
- 🛡️ **Rate Limiting**: Built-in abuse protection
- 🎯 **TypeScript**: Full type safety across frontend and backend

## Architecture

This is a TypeScript monorepo with two packages:

- **`/worker`**: Cloudflare Worker (backend API + static file serving)
- **`/client`**: React SPA (frontend application)

## Required Environment Variables

The following environment variables must be configured in your Cloudflare Worker:

| Variable | Description | Example |
|----------|-------------|---------|
| `SLACK_BOT_TOKEN` | Slack Bot User OAuth Token with required scopes | `xoxb-...` |
| `SLACK_TEAM_ID` | Your Slack workspace/team ID | `T1234567890` |
| `SLACK_LOG_CHANNEL_ID` | Channel ID for logging events | `C1234567890` |
| `POSTMARK_API_KEY` | Postmark server API key for sending emails | `12345678-...` |
| `RATE_LIMIT` | Maximum submissions per window per IP/email | `5` |
| `RATE_LIMIT_WINDOW_SEC` | Rate limit window duration in seconds | `3600` |

### Slack Bot Permissions

Your Slack bot requires these OAuth scopes:
- `channels:manage` - Create channels
- `channels:read` - Read channel information
- `chat:write` - Send messages to log channel
- `users:read` - Read user information
- `users:read.email` - Read user email addresses

## Development Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd conference-slack-form
   yarn install
   ```

2. **Start development servers:**

   **Option 1: View available commands**
   ```bash
   yarn dev
   ```

   **Option 2: Start services individually (recommended)**
   ```bash
   # Terminal 1 - Start React development server
   yarn dev:client

   # Terminal 2 - Start Cloudflare Worker development server
   yarn dev:worker
   ```

3. **Run tests:**
   ```bash
   yarn test           # Run tests once
   yarn test:watch     # Run tests in watch mode
   ```

4. **Format and lint:**
   ```bash
   yarn format         # Format code with Prettier
   yarn lint           # Check for linting errors
   yarn lint:fix       # Fix auto-fixable linting errors
   ```

## Building and Deployment

### Automated Deployment

Use the provided deployment script for streamlined building and deployment:

```bash
# Build client and worker (without deploying)
./scripts/deploy.sh

# Build and deploy to Cloudflare Workers
./scripts/deploy.sh --deploy
```

The deployment script will:
1. Build the React client application
2. Copy static assets to the worker's static directory
3. Build the Cloudflare Worker
4. Optionally deploy to Cloudflare (with `--deploy` flag)

### Manual Deployment

1. **Build the client:**
   ```bash
   cd client
   yarn install
   yarn run build
   ```

2. **Copy assets to worker:**
   ```bash
   cd worker
   mkdir -p static
   cp -r ../client/dist/* static/
   ```

3. **Build and deploy worker:**
   ```bash
   cd worker
   yarn install
   yarn run build
   yarn run deploy
   ```

### Setting Environment Variables in Cloudflare

After deployment, configure environment variables in the Cloudflare dashboard:

1. **Via Cloudflare Dashboard:**
   - Go to Workers & Pages → Your Worker → Settings → Environment Variables
   - Add each required environment variable listed above

2. **Via Wrangler CLI:**
   ```bash
   cd worker
   npx wrangler secret put SLACK_BOT_TOKEN
   npx wrangler secret put SLACK_TEAM_ID
   npx wrangler secret put SLACK_LOG_CHANNEL_ID
   npx wrangler secret put POSTMARK_API_KEY
   npx wrangler secret put RATE_LIMIT
   npx wrangler secret put RATE_LIMIT_WINDOW_SEC
   ```

### Smoke Testing

Test your deployment with the provided smoke test script:

```bash
# Test local development server
./scripts/smoke-test.sh http://localhost:8788

# Test production deployment
./scripts/smoke-test.sh https://your-worker.your-subdomain.workers.dev
```

The smoke test script will verify:
- ✅ API health check (`/api/ping`)
- ✅ Error handling and validation
- ✅ CORS configuration
- ✅ Static file serving
- ✅ Form submission (requires environment variables)

### Production Checklist

Before going live, ensure:

1. **Environment Variables**: All required variables are set in Cloudflare
2. **Slack Bot Setup**: Bot has proper permissions and is added to your workspace
3. **Postmark Configuration**: API key is valid and sending domain is verified
4. **Rate Limits**: Appropriate limits are configured for your use case
5. **Smoke Tests**: All tests pass against production URL
6. **DNS/Custom Domain**: (Optional) Custom domain is configured if needed

## Project Structure

```
conference-slack-form/
├── client/                 # React SPA
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── tsconfig.json
├── worker/                 # Cloudflare Worker
│   ├── src/
│   ├── wrangler.toml
│   ├── package.json
│   └── tsconfig.json
├── package.json           # Root workspace configuration
├── tsconfig.json          # Root TypeScript configuration
├── vitest.config.ts       # Test configuration
└── README.md
```

## Testing

The project includes comprehensive testing with Vitest:

- **Unit tests**: Validation, sanitization, and utility functions
- **Integration tests**: API endpoints and Slack/Postmark integrations
- **Component tests**: React component behavior

Run tests with `yarn test` or `yarn test:watch` for development.

## Contributing

1. Ensure all tests pass: `yarn test`
2. Format code: `yarn format`
3. Fix linting errors: `yarn lint:fix`
4. Build successfully: `yarn build`

## Security Notes

- Never commit API keys or tokens to version control
- All sensitive operations are handled server-side in the Cloudflare Worker
- Rate limiting prevents abuse and API quota exhaustion
- Input sanitization protects against injection attacks

## License

[Add your license here]
