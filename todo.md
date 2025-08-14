# TODO.md — Conference Slack Channel Form App

## 📈 Current Progress Summary

**✅ COMPLETED:**
- **Milestone 0**: Full repository setup with TypeScript, Yarn workspaces, ESLint, Prettier, Vitest
- **Milestone 1**: Worker API scaffolding with basic routes and structured error handling
- **Milestone 2**: ✅ **FULLY COMPLETED** - Validation & Sanitization with comprehensive Zod schemas, company name sanitization, unit tests (45/45 passing), and live API integration
- **Milestone 3**: ✅ **FULLY COMPLETED** - Slack Module with comprehensive API wrapper, channel creation with collision handling, team/guest invitations, logging, rate limit handling, and 19 passing unit tests

**🚧 PARTIALLY COMPLETED:**
- **Milestone 6**: Basic React SPA scaffold (needs form components)
- **Milestone 8**: Documentation and environment setup (needs deployment docs)
- **Milestone 9**: Initial deliverables documentation created

**🎯 NEXT UP:**
- **Milestone 4**: Postmark Email Module (welcome emails)

---

## 🚀 Milestone 0 — Repo & Tooling (COMPLETED)

* [x] Initialize repository with `yarn init` and `git init`
* [x] Create `/worker` and `/client` folders
* [x] Add root `package.json` with workspaces to run client & worker
* [x] Add TypeScript (`tsconfig.json`) at root and in each package with `strict: true`
* [x] Add ESLint + Prettier configuration
* [x] Add Vitest setup and sample placeholder test
* [x] Add root scripts: `dev`, `build`, `start`, `test`, `format`
* [x] Add README.md describing project and required environment variables:

  * `SLACK_BOT_TOKEN`
  * `SLACK_TEAM_ID`
  * `SLACK_LOG_CHANNEL_ID`
  * `POSTMARK_API_KEY`
  * `RATE_LIMIT`
  * `RATE_LIMIT_WINDOW_SEC`

---

## 🛠 Milestone 1 — Worker API Core (COMPLETED)

* [x] Scaffold Cloudflare Worker with TypeScript
* [x] Implement `/api/ping` route returning `{ok:true, version:"0.1.0"}`
* [x] Implement `/api/submit` stub returning 400 for invalid JSON
* [x] Define environment variable types in `types.ts`
* [x] Add `wrangler.toml` and build scripts
* [x] Ensure structured error handling (`{ok:false,errorCode,message}`)
* [x] Fix wrangler dev server configuration and router export
* [x] Add utility functions (UUID generation, JSON responses, error handling)
* [x] Implement CORS support and static file serving placeholder
* [x] Create comprehensive unit tests for worker logic

---

## ✅ Milestone 2 — Validation & Sanitization (COMPLETED)

* [x] Implement Zod schema for form inputs: `{companyName:string, email:string}`
* [x] Implement `sanitizeCompanyName()` with rules:

  * lowercase, remove accents, spaces → dashes
  * remove emojis/non-latin symbols
  * collapse multiple dashes, trim edges, truncate to 67 chars
* [x] Implement `validateAndSanitize()` function returning `{ok,value}` or `{ok:false,errors}`
* [x] Implement `isFreeEmailDomain(email)` helper with 12 major providers
* [x] Comprehensive unit tests for sanitization and validation edge cases (22 test cases)
* [x] Integrate with `/api/submit` endpoint with proper 422 error responses
* [x] Live API testing with curl - all acceptance criteria met:
  * ✅ `POST {"companyName": "Café 🚀", "email": "user@example.com"}` → `sanitizedCompanyName: "cafe"`
  * ✅ Validation errors return 422 with detailed error messages
  * ✅ Complex sanitization cases working (accents, symbols, formatting)
* [x] All tests passing (45/45) including new validation and existing worker tests

---

## 🔗 Milestone 3 — Slack Module (COMPLETED)

* [x] Create `createChannel(sanitizedName)` with collision handling
* [x] Create `inviteGroup(channelId)` for team using `SLACK_TEAM_ID`
* [x] Create `inviteGuest(email, channelId)` for single-channel guest
* [x] Implement `logToChannel(message, level)` helper
* [x] Mock Slack API for unit tests
* [x] Ensure rate limit handling (detect 429 and return actionable error)
* [x] Add tests for collision name handling
* [x] Comprehensive implementation with:
  * Full TypeScript types and error handling
  * Injectable fetch function for testing
  * 19 unit tests covering all scenarios (name collisions, rate limits, invitations, logging)
  * Channel name pattern: `ext-theguild-${sanitizedCompanyName}`
  * Production-ready with proper error surfacing
  * Updated environment variables (consolidated GUILD_GROUP_ID → SLACK_TEAM_ID)

---

## 📧 Milestone 4 — Postmark Email Module

* [ ] Implement `sendWelcomeEmail({companyName,email,channelName,channelUrl})`
* [ ] Use Postmark HTTP API with `POSTMARK_API_KEY`
* [ ] No retries; log errors via Slack
* [ ] Mock fetch for unit tests (success & failure flows)
* [ ] Add minimal inline HTML email template

---

## ⏱ Milestone 5 — Rate Limiter

* [ ] Implement in-memory rate-limiter (`Map`) per IP and per email
* [ ] Expose `checkAndIncrement(key, limit, windowSec)` function
* [ ] Wire into `/api/submit` (return 429 if blocked)
* [ ] Unit tests for bursts, expiry, and limit enforcement
* [ ] Document limitations for multi-instance deployments

---

## 🔌 Milestone 6 — Frontend UI

* [x] Scaffold React SPA with TypeScript, Tailwind, shadcn (basic setup)
* [ ] Create form:

  * Company Name input (autofocus, max 67 chars)
  * Email input
  * Submit button (disabled when invalid)
* [ ] Modal confirmation:

  * Shows raw + sanitized company name + email
  * Confirm/Cancel buttons
  * Loading indicator
* [ ] Fetch sanitized preview from `/api/sanitize-preview`
* [ ] Prevent double submits
* [ ] Clear form on success or cancel
* [ ] Dark mode support
* [ ] Add small unit tests for modal behavior and sanitizePreview function

---

## 🔗 Milestone 7 — Integration

* [ ] Wire frontend submit flow to `/api/submit`
* [ ] Show loading state while submitting
* [ ] Display success message in modal
* [ ] Handle rate-limit 429 responses (show type: email/ip)
* [ ] Handle Slack/worker errors gracefully
* [ ] Ensure all UI components are imported and referenced
* [ ] Manual E2E test steps documented for QA

---

## 📄 Milestone 8 — Documentation & Deployment

* [x] Create `.env.example` for worker and client
* [ ] Create `DEPLOYMENT.md` with Wrangler publish steps
* [ ] Document environment variables and rate limiter notes
* [ ] Create `QA_CHECKLIST.md` for 10 scenarios from Developer Spec
* [ ] Create `SECURITY.md` with token handling and recommended Slack scopes
* [ ] Deployment scripts:

  * `deploy.sh` → builds client, worker, publishes via Wrangler
  * `smoke-test.sh` → calls `/api/ping` and `/api/submit`
* [x] Update README with setup and deployment instructions

---

## 🧹 Milestone 9 — Final QA & Polish

* [ ] Ensure all TypeScript types are used correctly
* [ ] Final unit tests:

  * Sanitizer edge cases
  * Rate-limiter expiry
* [ ] Lint entire codebase and fix errors
* [ ] Ensure no secrets committed
* [x] Create `DELIVERABLES.md` with all entry points and extension instructions
* [ ] Create a manual runbook for non-dev deploy

---

## ✅ Optional / Future Improvements

* [ ] Replace in-memory rate-limiter with Redis for multi-instance safety
* [ ] Implement automated testing for Slack and Postmark flows
* [ ] Add CI/CD pipeline to run lint/test/build on push
* [ ] Add multi-language support (i18n)
* [ ] Enhance accessibility features (ARIA, keyboard navigation)
* [ ] Email template customization via Postmark template engine
