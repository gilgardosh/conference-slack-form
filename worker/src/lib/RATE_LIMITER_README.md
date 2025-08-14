# Rate Limiter

This module provides an in-memory rate limiter for Cloudflare Workers.

## Features

- **In-memory storage**: Uses Map-based storage for fast access
- **Time-window based**: Configurable time windows for rate limiting
- **Multiple key types**: Support for IP-based and email-based rate limiting
- **Burst handling**: Properly handles burst requests
- **Rate limit headers**: Returns standard rate limit headers in responses

## Usage

### Basic Usage

```typescript
import { checkIpRateLimit, checkEmailRateLimit } from './lib/rateLimiter';

// Check IP rate limit
const ipResult = checkIpRateLimit('192.168.1.1', 10, 3600); // 10 requests per hour
if (!ipResult.allowed) {
  // Rate limit exceeded
  console.log(`Rate limited. Reset at: ${new Date(ipResult.resetAt)}`);
}

// Check email rate limit
const emailResult = checkEmailRateLimit('user@example.com', 5, 300); // 5 requests per 5 minutes
if (!emailResult.allowed) {
  // Rate limit exceeded
}
```

### Advanced Usage

```typescript
import { RateLimiter } from './lib/rateLimiter';

const rateLimiter = new RateLimiter();

// Custom rate limiting
const result = rateLimiter.checkAndIncrement('custom:key', 100, 3600);

// Get status without incrementing
const status = rateLimiter.getStatus('custom:key', 100);

// Cleanup expired entries
const removedCount = rateLimiter.cleanup();
```

## API Reference

### `checkIpRateLimit(ip, limit, windowSec)`

Checks rate limit for an IP address.

- `ip`: IP address string
- `limit`: Maximum requests allowed
- `windowSec`: Time window in seconds
- Returns: `{allowed: boolean, remaining: number, resetAt: epochMillis}`

### `checkEmailRateLimit(email, limit, windowSec)`

Checks rate limit for an email address.

- `email`: Email address string
- `limit`: Maximum requests allowed
- `windowSec`: Time window in seconds
- Returns: `{allowed: boolean, remaining: number, resetAt: epochMillis}`

### `RateLimiter` Class

#### Methods

- `checkAndIncrement(key, limit, windowSec)`: Check and increment counter
- `getStatus(key, limit)`: Get current status without incrementing
- `clear()`: Clear all entries
- `cleanup()`: Remove expired entries
- `size()`: Get number of tracked keys

## Configuration

Rate limiting is configured via environment variables:

- `RATE_LIMIT`: Maximum requests per window (default: 10)
- `RATE_LIMIT_WINDOW_SEC`: Time window in seconds (default: 3600)

## Rate Limit Headers

The worker includes standard rate limit headers in responses:

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining-IP`: Remaining requests for IP
- `X-RateLimit-Remaining-Email`: Remaining requests for email
- `X-RateLimit-Reset`: Unix timestamp when limits reset

## Error Responses

When rate limited, the API returns a 429 status with:

```json
{
  "ok": false,
  "errorCode": "rate_limit",
  "message": "Rate limit exceeded",
  "metadata": {
    "type": "ip" | "email",
    "remaining": 0
  }
}
```

## Limitations

⚠️ **Important Limitations for Production**

### Single-Instance Only

This rate limiter is designed for single-instance Cloudflare Worker deployments. In multi-instance deployments:

- Each worker instance maintains its own counter
- Rate limits are **NOT** shared across instances
- Effective rate limit becomes `limit × number_of_instances`

### Memory Usage

- Memory usage grows with the number of unique keys
- No automatic cleanup of expired entries (manual cleanup required)
- Consider the impact on worker memory limits

### Persistence

- All rate limit data is lost when the worker restarts
- No persistence across deployments

## Alternatives for Multi-Instance Deployments

For distributed rate limiting, consider:

1. **Cloudflare KV**: Persistent storage across instances (eventual consistency)
2. **Durable Objects**: Strongly consistent, stateful rate limiting
3. **External services**: Redis, DynamoDB, etc.
4. **Cloudflare Rate Limiting**: Built-in rate limiting rules

## Testing

Run the test suite:

```bash
# Unit tests
npx vitest run src/lib/rateLimiter.test.ts

# Integration tests
npx vitest run src/lib/rateLimiter.integration.test.ts

# All rate limiter tests
npx vitest run src/lib/rateLimiter*.test.ts
```

## Example Implementation

See `src/index.ts` for the complete integration example showing:

- IP-based rate limiting (checked first)
- Email-based rate limiting (checked after validation)
- Proper error responses
- Rate limit headers
