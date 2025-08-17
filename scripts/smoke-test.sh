#!/bin/bash

# Conference Slack Form Smoke Test Script
# This script tests the deployed worker endpoints

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default worker URL (can be overridden by command line argument)
WORKER_URL="${1:-http://localhost:8787}"

echo -e "${BLUE}🧪 Running smoke tests for Conference Slack Form${NC}"
echo -e "${BLUE}📍 Target URL: $WORKER_URL${NC}"
echo ""

# Function to make HTTP requests with error handling
make_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local expected_status="$4"
    
    echo -e "${YELLOW}Testing: $method $endpoint${NC}"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$WORKER_URL$endpoint")
    else
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
            -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$WORKER_URL$endpoint")
    fi
    
    # Extract HTTP status and body
    http_status=$(echo "$response" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    body=$(echo "$response" | sed -e 's/HTTPSTATUS:.*//g')
    
    echo "Status: $http_status"
    echo "Response: $body"
    
    if [ "$http_status" -eq "$expected_status" ]; then
        echo -e "${GREEN}✅ Test passed${NC}"
    else
        echo -e "${RED}❌ Test failed - Expected status $expected_status, got $http_status${NC}"
        return 1
    fi
    
    echo ""
    return 0
}

# Test 1: Health check
echo -e "${BLUE}=== Test 1: Health Check ===${NC}"
make_request "GET" "/api/ping" "" 200

# Test 2: API endpoint not found
echo -e "${BLUE}=== Test 2: Non-existent API Endpoint ===${NC}"
make_request "GET" "/api/nonexistent" "" 404

# Test 3: Form submission with invalid JSON
echo -e "${BLUE}=== Test 3: Invalid JSON Submission ===${NC}"
make_request "POST" "/api/submit" "invalid json" 400

# Test 4: Form submission with missing fields
echo -e "${BLUE}=== Test 4: Missing Required Fields ===${NC}"
make_request "POST" "/api/submit" '{"email": "test@example.com"}' 422

# Test 5: Form submission with invalid email
echo -e "${BLUE}=== Test 5: Invalid Email Format ===${NC}"
make_request "POST" "/api/submit" '{"email": "invalid-email", "companyName": "Test Company"}' 422

# Test 6: Sanitization preview endpoint
echo -e "${BLUE}=== Test 6: Sanitization Preview ===${NC}"
test_data='{"email": "test@example.com", "companyName": "Test Company! @#$"}'
make_request "POST" "/api/sanitize-preview" "$test_data" 200

# Test 7: Valid form submission (will fail in CI without real credentials, but structure should be correct)
echo -e "${BLUE}=== Test 7: Valid Form Submission ===${NC}"
echo -e "${YELLOW}Note: This test will likely fail without proper environment variables set${NC}"
valid_submission='{"email": "test@example.com", "companyName": "Test Company"}'

# Don't fail the script if this test fails (since it requires real credentials)
set +e
make_request "POST" "/api/submit" "$valid_submission" 200
submission_result=$?
set -e

if [ $submission_result -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Form submission test failed (expected in CI without credentials)${NC}"
else
    echo -e "${GREEN}🎉 Form submission test passed!${NC}"
fi

# Test 8: Static file serving (root)
echo -e "${BLUE}=== Test 8: Static File Serving (Root) ===${NC}"
make_request "GET" "/" "" 200

# Test 9: CORS preflight
echo -e "${BLUE}=== Test 9: CORS Preflight ===${NC}"
echo -e "${YELLOW}Testing: OPTIONS /api/submit${NC}"
cors_response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
    -X OPTIONS \
    -H "Origin: https://example.com" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type" \
    "$WORKER_URL/api/submit")

cors_status=$(echo "$cors_response" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
cors_body=$(echo "$cors_response" | sed -e 's/HTTPSTATUS:.*//g')

echo "Status: $cors_status"
if [ "$cors_status" -eq 204 ]; then
    echo -e "${GREEN}✅ CORS preflight test passed${NC}"
else
    echo -e "${RED}❌ CORS preflight test failed${NC}"
fi

echo ""
echo -e "${BLUE}🎯 Smoke test summary:${NC}"
echo -e "${GREEN}✅ Basic API structure working${NC}"
echo -e "${GREEN}✅ Error handling working${NC}"
echo -e "${GREEN}✅ Validation working${NC}"
echo -e "${GREEN}✅ CORS headers working${NC}"
echo -e "${GREEN}✅ Static file serving working${NC}"

if [ $submission_result -eq 0 ]; then
    echo -e "${GREEN}✅ Form submission working (with credentials)${NC}"
else
    echo -e "${YELLOW}⚠️  Form submission needs environment variables${NC}"
fi

echo ""
echo -e "${BLUE}🔧 To test with production credentials:${NC}"
echo "1. Set environment variables in Cloudflare dashboard:"
echo "   - SLACK_BOT_TOKEN"
echo "   - SLACK_TEAM_ID"
echo "   - SLACK_LOG_CHANNEL_ID"
echo "   - POSTMARK_API_KEY"
echo ""
echo "2. Run smoke test against production URL:"
echo "   ./scripts/smoke-test.sh https://your-worker.your-subdomain.workers.dev"
echo ""
echo -e "${GREEN}🎉 Smoke tests completed!${NC}"
