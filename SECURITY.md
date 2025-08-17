# Security Guidelines

This document outlines the security considerations and best practices for the Conference Slack Form application.

## Overview

The application follows a secure serverless architecture where sensitive operations and API tokens are handled exclusively on the server-side (Cloudflare Worker), never exposing credentials to client-side code.

---

## Token Security

### ✅ Server-Side Only Access

**Slack API Tokens and Postmark Keys are NEVER exposed client-side:**

- All API tokens are stored as **Cloudflare Worker environment variables** (encrypted at rest)
- Client applications cannot access these tokens through any mechanism
- Tokens are only accessible within the Worker runtime environment
- No tokens are embedded in client-side JavaScript bundles
- No tokens are transmitted in API responses to clients

### ✅ Environment Variable Security

**Best practices for managing secrets:**

```bash
# Use Wrangler CLI to set secrets (automatically encrypted)
npx wrangler secret put SLACK_BOT_TOKEN
npx wrangler secret put POSTMARK_API_KEY

# Never commit secrets to version control
# Use .env.example files with placeholder values only
# Ensure .env files are in .gitignore
```

### ❌ What NOT to do:

- Never put actual secrets in `.env.example` files
- Never commit `.env` files with real values
- Never expose tokens in client-side environment variables (`VITE_*`)
- Never log tokens in console or error messages
- Never return tokens in API responses

---

## Slack Token Configuration

### Required Scopes

The Slack Bot Token must have the following **minimum required scopes:**

| Scope | Purpose | Description |
|-------|---------|-------------|
| `channels:write` | Channel creation | Create new public/private channels |
| `users:write` | User invitations | Invite external users as single-channel guests |
| `users:read` | User lookup | Read user information for invitations |
| `chat:write` | Logging | Send messages to logging channel |

### ⚠️ Additional Scopes (Use with Caution)

These scopes provide broader access and should only be added if specifically required:

| Scope | Risk Level | Notes |
|-------|------------|-------|
| `channels:read` | Low | Read channel information |
| `users:read.email` | Medium | Access user email addresses |
| `admin` | **HIGH** | ❌ **Never grant admin scopes** |
| `files:write` | Medium | Only if file uploads needed |

### 🔒 Recommended Security Configuration

1. **Create a dedicated Slack App** for this integration (don't reuse existing apps)
2. **Use Bot User OAuth Token** (`xoxb-`) not User OAuth Token (`xoxp-`)
3. **Regularly rotate tokens** (every 90 days recommended)
4. **Monitor token usage** in Slack App management dashboard
5. **Revoke tokens immediately** if compromise is suspected

### Team Mentions Security

The application invites the `@guild` team group to channels. Ensure:

- The `@guild` group contains only intended team members
- Team group membership is regularly audited
- External contractors are not included unless necessary

---

## CORS (Cross-Origin Resource Sharing)

### Current Configuration

The Worker implements strict CORS policies:

```typescript
// Allowed origins for development and production
const allowedOrigins = [
  'http://localhost:3000',     // Client dev server
  'http://localhost:5173',     // Vite dev server  
  'https://your-domain.com'    // Production domain
];

// CORS headers applied to all responses
'Access-Control-Allow-Origin': validOrigin
'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
'Access-Control-Allow-Headers': 'Content-Type'
'Access-Control-Max-Age': '86400'
```

### 🔒 Security Benefits

- **Prevents unauthorized domains** from making API calls
- **Blocks malicious sites** from submitting forms
- **Limits attack surface** to known, trusted origins
- **Prevents CSRF attacks** from arbitrary domains

### ⚠️ CORS Configuration Guidelines

**For Development:**
```typescript
// Allow localhost with specific ports only
const devOrigins = [
  'http://localhost:3000',
  'http://localhost:5173'
];
```

**For Production:**
```typescript
// Allow only your production domain(s)
const prodOrigins = [
  'https://conference-form.yourdomain.com',
  'https://yourdomain.com'
];
```

**❌ Never allow:**
```typescript
// DON'T: Wildcard origins in production
'Access-Control-Allow-Origin': '*'

// DON'T: Dynamic origin allowing
'Access-Control-Allow-Origin': request.headers.get('Origin')
```

---

## Input Sanitization & Validation

### Client-Side Validation (First Line of Defense)

**Purpose:** User experience and basic input filtering
**Security level:** ⚠️ Insufficient alone (can be bypassed)

```typescript
// Company name validation
- Length: max 67 characters
- Required: cannot be empty
- Format: basic character restrictions

// Email validation  
- Format: standard email regex
- Blocklist: free email providers
- Required: cannot be empty
```

### Server-Side Validation (Security Boundary)

**Purpose:** Security enforcement and data integrity
**Security level:** ✅ Trusted validation

```typescript
// Company name sanitization
- Remove/replace dangerous characters
- Normalize Unicode characters
- Strip HTML/script tags
- Limit final length after processing

// Email sanitization
- Trim whitespace
- Normalize case
- Validate against RFC standards
- Check for injection attempts
```

### 🔒 Sanitization Security Features

1. **XSS Prevention:**
   - All user input is sanitized before processing
   - HTML tags and script content removed
   - Special characters properly escaped

2. **SQL Injection Prevention:**
   - No SQL database in use (serverless architecture)
   - All data processing in-memory per request

3. **Command Injection Prevention:**
   - No shell command execution
   - All API calls use validated, parameterized requests

4. **Path Traversal Prevention:**
   - No file system access from user input
   - Fixed API endpoints and channel naming patterns

---

## Rate Limiting Security

### Protection Against Abuse

The rate limiting system provides security against:

- **Spam submissions** from individual IPs
- **Email bombing** attacks using repeated submissions
- **Resource exhaustion** of Slack API quotas
- **Postmark quota abuse** and email reputation damage

### Rate Limit Implementation

```typescript
// Per-IP rate limiting
const ipKey = `ip:${clientIP}`;
const ipLimit = parseInt(RATE_LIMIT); // e.g., 5 requests

// Per-email rate limiting  
const emailKey = `email:${sanitizedEmail}`;
const emailLimit = 1; // One submission per email ever

// Time window
const windowSeconds = parseInt(RATE_LIMIT_WINDOW_SEC); // e.g., 3600
```

### 🔒 Security Considerations

**Current Limitations:**
- ⚠️ **In-memory storage** - limits reset on Worker restart
- ⚠️ **Single-instance** - multiple Worker instances have separate limits
- ⚠️ **No distributed coordination** across geographic regions

**Recommended Production Improvements:**
1. **Durable Objects** for centralized rate limiting
2. **Cloudflare KV** for persistent storage (eventual consistency)
3. **Redis integration** for real-time distributed limiting
4. **IP reputation checking** against known VPN/proxy lists

---

## API Security

### Endpoint Protection

**Public Endpoints** (require rate limiting):
- `POST /api/submit` - Form submission
- `POST /api/sanitize-preview` - Company name preview

**Security measures applied:**
- CORS origin validation
- Input sanitization and validation
- Rate limiting per IP and email
- Request size limits
- Content-type validation

### Request Security

```typescript
// Content-Type validation
if (contentType !== 'application/json') {
  return 400; // Reject non-JSON requests
}

// Request size limits
const MAX_REQUEST_SIZE = 1024; // 1KB limit

// JSON parsing with error handling
try {
  const data = await request.json();
} catch (error) {
  return 400; // Malformed JSON
}
```

### Response Security

**Safe error messages:**
- Generic error messages for external API failures
- No sensitive information leaked in error responses
- Consistent error format to prevent information disclosure

**Example secure error handling:**
```typescript
// ✅ Good: Generic message
"Submission failed — we're looking into it"

// ❌ Bad: Exposes internal details  
"Slack API returned 403: invalid_auth token xoxb-123..."
```

---

## Logging and Monitoring Security

### Secure Logging Practices

**What IS logged to Slack:**
- Successful submission events (email + company name)
- Rate limit violations (IP address only)
- Generic error events (no sensitive details)
- Application startup/deployment events

**What is NOT logged:**
- API tokens or secrets
- Full request/response bodies
- Internal error details with sensitive information
- User agent strings or detailed client information

### Log Channel Security

**Slack logging channel configuration:**
- Private channel with restricted membership
- Only essential team members have access
- Channel history retention policies configured
- Regular audit of channel membership

### Monitoring Recommendations

1. **Set up alerts** for high error rates
2. **Monitor rate limit patterns** for potential attacks
3. **Track API quota usage** for Slack and Postmark
4. **Regular security reviews** of logged data
5. **Audit channel access** monthly

---

## Data Privacy & Retention

### Data Handling Principles

**Ephemeral Processing:**
- No persistent database storage
- All data processed in-memory per request
- No long-term data retention by the application

**Third-Party Data Sharing:**
- Slack: Company name and email (for channel creation and invites)
- Postmark: Email address (for welcome email delivery)
- No data shared with analytics or tracking services

### GDPR Compliance Considerations

**Data Controller responsibilities:**
- Inform users what data is collected and why
- Provide mechanisms for data deletion requests
- Maintain records of processing activities
- Implement privacy by design principles

**User rights:**
- Right to access: Users can see their data in Slack channels
- Right to deletion: Channels can be deleted, emails can be removed from Postmark
- Right to portability: Data is minimal and easily exportable

---

## Incident Response

### Security Incident Types

1. **Token Compromise:**
   - Immediately revoke affected tokens
   - Generate new tokens with same scopes
   - Update Worker environment variables
   - Monitor for unauthorized usage

2. **Unauthorized Access:**
   - Review Slack audit logs
   - Check Postmark activity logs
   - Audit Worker deployment history
   - Revoke and rotate all tokens

3. **Data Breach:**
   - Assess scope of exposed data
   - Notify affected users if required
   - Document incident details
   - Implement additional security measures

### Emergency Procedures

**Immediate Response:**
```bash
# 1. Disable Worker immediately
npx wrangler delete

# 2. Revoke Slack tokens
# Go to Slack App management → OAuth & Permissions → Revoke

# 3. Revoke Postmark keys  
# Go to Postmark → API Tokens → Delete

# 4. Check logs for unauthorized activity
npx wrangler tail --format pretty
```

**Recovery Steps:**
1. Investigate root cause
2. Implement security fixes
3. Generate new tokens with minimal required scopes
4. Update documentation and procedures
5. Conduct post-incident review

---

## Security Checklist

### Pre-Deployment Security Review

- [ ] All secrets stored as encrypted environment variables
- [ ] No tokens in client-side code or config files
- [ ] CORS origins limited to trusted domains only
- [ ] Input validation implemented server-side
- [ ] Rate limiting configured and tested
- [ ] Error messages don't expose sensitive information
- [ ] Logging excludes sensitive data
- [ ] Slack token has minimal required scopes only
- [ ] Private logging channel configured with restricted access

### Regular Security Maintenance

- [ ] Monthly: Audit Slack app permissions and usage
- [ ] Quarterly: Rotate API tokens and keys
- [ ] Quarterly: Review CORS allowed origins
- [ ] Annually: Full security architecture review
- [ ] As needed: Update rate limiting based on usage patterns
- [ ] As needed: Review and update logging practices

### Monitoring & Alerts

- [ ] Slack alerts configured for high error rates
- [ ] Postmark delivery monitoring enabled
- [ ] Worker error rate monitoring via Cloudflare analytics
- [ ] Regular review of rate limiting effectiveness
- [ ] Monthly audit of logged data and channel access

---

## Contact & Reporting

For security concerns or to report vulnerabilities:

1. **Internal team:** Use designated security Slack channel
2. **External researchers:** Follow responsible disclosure practices
3. **Urgent issues:** Contact team lead directly
4. **Documentation updates:** Submit pull requests with security rationale

**Remember:** Security is everyone's responsibility. When in doubt, choose the more secure option.
