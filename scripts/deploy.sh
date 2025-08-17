#!/bin/bash

# Conference Slack Form Deployment Script
# This script builds the client, places static assets into the worker, and builds the worker

set -e  # Exit on any error

echo "🚀 Starting deployment process..."

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT_DIR="$PROJECT_ROOT/client"
WORKER_DIR="$PROJECT_ROOT/worker"

echo "📂 Project root: $PROJECT_ROOT"

# Step 1: Build the client
echo "📦 Building client application..."
cd "$CLIENT_DIR"

if [ ! -f "package.json" ]; then
    echo "❌ Error: client/package.json not found"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📥 Installing client dependencies..."
    yarn install
fi

# Build the client
echo "🔨 Running client build..."
yarn run build

# Verify build output exists
if [ ! -d "dist" ]; then
    echo "❌ Error: Client build failed - dist directory not found"
    exit 1
fi

echo "✅ Client build completed successfully"

# Step 2: Copy static assets to worker
echo "📋 Copying static assets to worker..."
cd "$WORKER_DIR"

# Create static assets directory in worker if it doesn't exist
mkdir -p "static"

# Copy all client build files to worker static directory
cp -r "$CLIENT_DIR/dist/"* "static/"

echo "✅ Static assets copied to worker/static/"

# Step 3: Build the worker
echo "🔧 Building worker..."

if [ ! -f "package.json" ]; then
    echo "❌ Error: worker/package.json not found"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📥 Installing worker dependencies..."
    yarn install
fi

# Run type check first
echo "🔍 Running type check..."
yarn run type-check

# Build the worker
echo "🔨 Running worker build..."
yarn run build

echo "✅ Worker build completed successfully"

# Step 4: Optional deployment (if --deploy flag is passed)
if [ "$1" = "--deploy" ]; then
    echo "🚢 Deploying to Cloudflare..."
    
    # Check if wrangler is configured
    if ! npx wrangler whoami > /dev/null 2>&1; then
        echo "❌ Error: Wrangler not authenticated. Run 'npx wrangler login' first."
        exit 1
    fi
    
    # Deploy the worker
    yarn run deploy
    
    echo "✅ Deployment completed successfully!"
else
    echo "ℹ️  Build completed. To deploy, run: $0 --deploy"
    echo "ℹ️  Or manually run: cd $WORKER_DIR && yarn run deploy"
fi

echo "🎉 Deployment process completed!"
echo ""
echo "Next steps:"
echo "1. Set environment variables in Cloudflare dashboard or via wrangler:"
echo "   - SLACK_BOT_TOKEN"
echo "   - SLACK_TEAM_ID" 
echo "   - SLACK_LOG_CHANNEL_ID"
echo "   - POSTMARK_API_KEY"
echo "   - RATE_LIMIT (optional, default: 10)"
echo "   - RATE_LIMIT_WINDOW_SEC (optional, default: 3600)"
echo ""
echo "2. Test the deployment with: ./scripts/smoke-test.sh [WORKER_URL]"
