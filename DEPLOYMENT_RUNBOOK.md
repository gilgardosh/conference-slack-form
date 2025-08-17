# Conference Slack Form - Manual Deployment Runbook

**For Non-Developers**: Copy and paste these commands to deploy the application.

## Prerequisites

1. **Node.js and Yarn**: Ensure you have Node.js 18+ and Yarn installed
2. **Cloudflare Account**: Sign up at https://cloudflare.com
3. **Slack App**: Create a Slack app with the required permissions
4. **Postmark Account**: Sign up at https://postmarkapp.com

## Step 1: Clone and Setup Repository

```bash
# Clone the repository
git clone https://github.com/gilgardosh/conference-slack-form.git
cd conference-slack-form

# Install dependencies
yarn install
```

## Step 2: Create Environment Files

### Create Cloudflare Worker Environment File

```bash
# Create worker environment file
cp worker/.env.example worker/.env
```

Edit `worker/.env` with your actual values:

```bash
# Open the file in your preferred editor
nano worker/.env
```

Replace with your actual values:
```
# Slack Bot User OAuth Token (get from Slack App settings)
SLACK_BOT_TOKEN=xoxb-your-actual-bot-token-here

# Your Slack workspace ID (from Slack App settings)
SLACK_TEAM_ID=T123456789

# Channel ID where logs should be sent (create a #bot-logs channel)
SLACK_LOG_CHANNEL_ID=C123456789

# Your Postmark API key (from Postmark settings)
POSTMARK_API_KEY=your-actual-postmark-key-here

# Optional: Rate limiting settings (use defaults if unsure)
RATE_LIMIT=10
RATE_LIMIT_WINDOW_SEC=3600
```

### Create Client Environment File

```bash
# Create client environment file
cp client/.env.example client/.env.local
```

Edit `client/.env.local`:
```bash
nano client/.env.local
```

Replace with your worker URL (you'll get this after deployment):
```
VITE_API_BASE_URL=https://your-worker-name.your-subdomain.workers.dev
```

## Step 3: Test Locally (Optional but Recommended)

```bash
# Run tests to ensure everything works
yarn run test --run

# Build to check for errors
yarn run build
```

Expected output:
```
✅ Test Files  15 passed (15)
✅ Tests  157 passed (157)
✅ Build successful
```

## Step 4: Deploy to Cloudflare

### Login to Cloudflare

```bash
# Install Cloudflare CLI (if not already installed)
cd worker
yarn global add wrangler

# Login to Cloudflare
wrangler login
```

Follow the browser prompts to authorize.

### Configure Deployment

```bash
# Still in worker directory
# Copy the example config
cp wrangler.example.toml wrangler.toml
```

Edit `wrangler.toml`:
```bash
nano wrangler.toml
```

Update the name and account details:
```toml
name = "conference-slack-form"  # Change this to your preferred name
main = "src/index.ts"
compatibility_date = "2024-08-01"

# Update with your account ID (get from Cloudflare dashboard)
account_id = "your-cloudflare-account-id"

[env.production]
vars = { }  # Environment variables will be set via dashboard
```

### Set Environment Variables in Cloudflare

```bash
# Set each environment variable (replace with your actual values)
wrangler secret put SLACK_BOT_TOKEN
# When prompted, paste your actual Slack bot token

wrangler secret put SLACK_TEAM_ID
# When prompted, paste your Slack team ID

wrangler secret put SLACK_LOG_CHANNEL_ID
# When prompted, paste your log channel ID

wrangler secret put POSTMARK_API_KEY
# When prompted, paste your Postmark API key

# Optional: Set rate limiting (use defaults if unsure)
wrangler secret put RATE_LIMIT
# Enter: 10

wrangler secret put RATE_LIMIT_WINDOW_SEC
# Enter: 3600
```

### Deploy the Worker

```bash
# Deploy to production
wrangler deploy

# Expected output:
# ✨ Your worker has some dependencies that require Node.js APIs:
# Published conference-slack-form
# Current Deployment ID: xxxx-xxxx-xxxx
# https://conference-slack-form.your-subdomain.workers.dev
```

**Save the URL** - you'll need it for the next step!

## Step 5: Update Client Configuration

```bash
# Go back to root directory
cd ..

# Update client environment with actual worker URL
nano client/.env.local
```

Replace the URL with your actual worker URL:
```
VITE_API_BASE_URL=https://conference-slack-form.your-subdomain.workers.dev
```

## Step 6: Build and Deploy Client Assets

```bash
# Build the client
yarn workspace conference-slack-form-client build

# Copy built assets to worker static directory
cp -r client/dist/* worker/static/

# Redeploy worker with client assets
cd worker
wrangler deploy
```

## Step 7: Test Deployment

```bash
# Run smoke tests (replace URL with your actual URL)
cd ..
./scripts/smoke-test.sh https://conference-slack-form.your-subdomain.workers.dev
```

Expected output:
```
✅ Health check passed
✅ Sanitize preview works
✅ Static file serving works
🎉 All smoke tests passed!
```

## Step 8: Final Verification

1. **Open the application** in your browser:
   - Go to: `https://conference-slack-form.your-subdomain.workers.dev`
   - You should see the form interface

2. **Test form submission**:
   - Enter a test company name and your email
   - Submit the form
   - Check that:
     - A Slack channel was created
     - You received an email
     - Logs appear in your Slack log channel

## Troubleshooting

### Common Issues

1. **"Invalid token" error**:
   ```bash
   # Check your Slack token
   wrangler secret list
   # Re-add the token if needed
   wrangler secret put SLACK_BOT_TOKEN
   ```

2. **"Cannot create channel" error**:
   - Ensure your Slack bot has these permissions:
     - `channels:manage`
     - `chat:write`
     - `users:read`
     - `users:read.email`

3. **Email not sending**:
   ```bash
   # Check Postmark API key
   wrangler secret put POSTMARK_API_KEY
   ```

4. **Rate limit errors**:
   ```bash
   # Check rate limit settings
   wrangler secret put RATE_LIMIT
   wrangler secret put RATE_LIMIT_WINDOW_SEC
   ```

### Getting Help

1. **Check logs**:
   ```bash
   wrangler tail
   ```

2. **Check worker status**:
   - Go to Cloudflare dashboard
   - Navigate to Workers & Pages
   - Click on your worker name
   - Check metrics and logs

3. **Test individual endpoints**:
   ```bash
   # Test health check
   curl https://your-worker-url.workers.dev/api/ping
   
   # Expected: {"ok":true,"version":"0.1.0"}
   ```

## Post-Deployment Configuration

### 1. Custom Domain (Optional)

If you want to use a custom domain:

1. Go to Cloudflare dashboard
2. Navigate to Workers & Pages
3. Click on your worker
4. Go to Settings > Triggers
5. Add custom domain

### 2. Analytics Setup

To monitor usage:

1. Go to Cloudflare dashboard
2. Navigate to Analytics & Logs
3. Set up Worker Analytics
4. Monitor requests, errors, and performance

### 3. Security Settings

1. **Rate Limiting**: Adjust if needed:
   ```bash
   wrangler secret put RATE_LIMIT   # Default: 10
   wrangler secret put RATE_LIMIT_WINDOW_SEC  # Default: 3600
   ```

2. **CORS**: If you need to restrict origins, edit `worker/src/index.ts`

## Maintenance

### Regular Tasks

1. **Monitor logs** in your Slack channel
2. **Check Cloudflare metrics** monthly
3. **Update dependencies** quarterly:
   ```bash
   yarn upgrade
   yarn run test --run
   yarn run build
   wrangler deploy
   ```

### Backup

Important files to backup:
- `worker/.env` (contains your configuration)
- `wrangler.toml` (deployment configuration)
- `client/.env.local` (client configuration)

---

**🎉 Deployment Complete!**

Your Conference Slack Form is now live at:
`https://your-worker-name.your-subdomain.workers.dev`

For technical support, refer to the project documentation or contact the development team.
