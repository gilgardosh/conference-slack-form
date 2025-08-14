#!/bin/bash

echo "🧪 Testing Conference Slack Form Worker Endpoints"
echo "=================================================="
echo ""

# Start the server in background and give it time to start
echo "🚀 Starting wrangler dev server..."
cd /Users/gilgardosh/guild/conference-slack-form/worker
yarn dev > /dev/null 2>&1 &
SERVER_PID=$!
sleep 3

echo "📝 Testing endpoints..."
echo ""

# Test 1: Ping endpoint
echo "1️⃣  Testing GET /api/ping:"
PING_RESULT=$(curl -s http://localhost:8787/api/ping)
echo "Response: $PING_RESULT"
echo ""

# Test 2: Submit endpoint with empty body (should return 400)
echo "2️⃣  Testing POST /api/submit with empty body:"
SUBMIT_EMPTY_RESULT=$(curl -s -X POST http://localhost:8787/api/submit -H "Content-Type: application/json" -d '{}')
echo "Response: $SUBMIT_EMPTY_RESULT"
echo ""

# Test 3: Submit endpoint with valid data
echo "3️⃣  Testing POST /api/submit with valid data:"
SUBMIT_VALID_RESULT=$(curl -s -X POST http://localhost:8787/api/submit -H "Content-Type: application/json" -d '{"companyName":"Test Company","email":"test@example.com"}')
echo "Response: $SUBMIT_VALID_RESULT"
echo ""

# Clean up
echo "🧹 Cleaning up..."
kill $SERVER_PID 2>/dev/null

echo "✅ Tests completed!"
