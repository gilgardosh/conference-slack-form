#!/bin/bash

echo "Testing rate limiting functionality..."

# Start the worker if it's not running
echo "Making requests to test rate limiting..."

# First request
echo "Request 1:"
curl -X POST http://localhost:8787/api/submit \
  -H "Content-Type: application/json" \
  -d '{"companyName": "Test Company", "email": "test@example.com"}' \
  -i -s | head -20

echo -e "\n\nRequest 2:"
curl -X POST http://localhost:8787/api/submit \
  -H "Content-Type: application/json" \
  -d '{"companyName": "Test Company 2", "email": "test2@example.com"}' \
  -i -s | head -20

echo -e "\n\nBurst test (10 requests):"
for i in {1..10}; do
  echo "Request $i:"
  response=$(curl -X POST http://localhost:8787/api/submit \
    -H "Content-Type: application/json" \
    -d "{\"companyName\": \"Test Company $i\", \"email\": \"burst$i@example.com\"}" \
    -s -w "HTTP_STATUS:%{http_code}")
  
  echo "Status: $(echo $response | grep -o 'HTTP_STATUS:[0-9]*' | cut -d: -f2)"
  echo "Body: $(echo $response | sed 's/HTTP_STATUS:[0-9]*$//')"
  echo "---"
done
