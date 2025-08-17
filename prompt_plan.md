# Blueprint — Conference Slack Channel Form App

Below is a complete, iterative blueprint plus a chain of small, implementable tasks and a **series of code-generation LLM prompts** that you can feed (one-by-one, in order) to implement the app end-to-end. Each prompt builds on the previous work and **must** be executed in sequence. Prompts are placed inside code blocks (tagged as text) and include context, constraints, outputs, and tiny acceptance tests so the generator can't leave orphaned code.

---

# 1) High-level summary (one-paragraph)

Single-file React SPA (Tailwind + shadcn) served by a Cloudflare Worker. The Worker also exposes an API that validates/sanitizes form input, rate-limits submissions, creates a Slack channel and a single-channel guest invite, sends a Postmark email, and logs events into a Slack logging channel — all server-side. No DB persistence. Manual QA scenarios listed in the Developer Spec will be used to verify correctness.

---

# 2) Architecture & data flow (concise)

1. User opens SPA (served by Worker).
2. User fills company name + email → client-side basic validation + opens modal.
3. Modal shows raw and *server-sanitized preview* (server sanitization is definitive) — user confirms.
4. Client POSTs to Worker API `/api/submit`.
5. Worker: rate-limit (IP/email), server-side sanitize & validate (Zod), ensure `sanitizedCompanyName` ≠ empty, compute `channelName`, check Slack collisions, create channel, invite `@guild` group and single-channel guest, post to Slack logging channel, send Postmark email. Return minimal success/failure to client.
6. Client shows modal success; local form resets.

---

# 3) Milestones (phased)

* **M0 — Repo + Tooling**: initialize repo, TypeScript, monorepo layout (client + worker), build scripts, strict linting, basic CI (optional), eslint/prettier, vitest.
* **M1 — Worker API core**: Cloudflare Worker scaffolding, basic API route `/api/ping` and `/api/submit` stub, env config.
* **M2 — Validation & Sanitization**: Zod schemas + sanitize utilities + unit tests.
* **M3 — Slack module**: Slack helper to create channel, handle collisions, invite group and guest; logging helper to log to designated Slack channel.
* **M4 — Email module**: Postmark integration + template wiring.
* **M5 — Rate-limiter**: IP + email rate-limiter with in-memory cache for Worker (config via env).
* **M6 — Frontend UI**: React + Tailwind + shadcn UI form, modal behavior, accessibility hooks, dark mode.
* **M7 — Integration**: Wire frontend to Worker API, implement loading states, error flows, retries/no-retries for email.
* **M8 — Deployment & QA**: Wrangler config, environment variable docs, deploy script, QA checklist & manual test results.

---

# 4) Chunk → small steps → micro-steps

Below each Milestone, I break into small steps and then into micro-steps so each action is small & testable.

## M0 — Repo + Tooling

**Small steps**

1. Initialize repository (npm + git).
2. Create monorepo folders: `/worker` and `/client`.
3. Add TypeScript, ESLint, Prettier, Vitest, Tailwind.
4. Add basic build scripts.

**Micro-steps**

* `yarn init -y`
* `git init`
* Create `package.json` workspace config (or single package) with scripts: `build`, `dev`, `test`, `format`.
* Add `tsconfig.json` with `strict: true`.
* Add `eslintrc` + `prettier`.
* Add `vitest` and a sample test file.

---

## M1 — Worker API core

**Small steps**

1. Scaffold Cloudflare Worker with TypeScript handler.
2. Expose routes: GET `/api/ping` (health) and POST `/api/submit` (stub).
3. Serve React static files from Worker (or proxy to dev server in dev).

**Micro-steps**

* Add `worker/src/index.ts` with router.
* Implement `/api/ping` returning JSON `{ok:true}`.
* Implement `/api/submit` that validates JSON shape and returns 400/200 with structured errors.
* Add environment variable typings for `SLACK_BOT_TOKEN`, `POSTMARK_API_KEY`, etc.

Acceptance: `curl` to `/api/ping` returns 200; POST to `/api/submit` with malformed body returns 400.

---

## M2 — Validation & Sanitization

**Small steps**

1. Implement Zod schema for input.
2. Implement sanitization utilities for company name (lowercase, latin-only, spaces → dashes, remove emojis, accent folding).
3. Tests for multiple inputs.

**Micro-steps**

* Create `worker/src/lib/validation.ts` exporting Zod schema and `sanitizeCompanyName()` function.
* Unit tests for accent removal, emoji stripping, and length enforcement.

Acceptance: sanitized examples in tests match expected outputs.

---

## M3 — Slack module

**Small steps**

1. Implement Slack client wrapper (uses `fetch` to Slack Web API via `SLACK_BOT_TOKEN`).
2. Channel creation with collision handling.
3. Invite `@guild` group and single-channel guest invite flow.
4. Logging function to send messages to logging channel.

**Micro-steps**

* Create `worker/src/lib/slack.ts` exposing:

  * `createChannelIfNotExists(sanitizedName)`
  * `inviteGuestToChannel(email, channelId)`
  * `inviteGroupToChannel(channelId)`
  * `logEvent(message, level)` (posts to logging channel)
* Unit/integration tests using mocks (or a small abstraction layer so tests don't hit Slack).
* Ensure rate limits are respected (backoff), but errors are logged, not retried indefinitely.

Acceptance: functions return predictable shapes; test mocks assert correct endpoints and payloads.

---

## M4 — Postmark module

**Small steps**

1. Implement Postmark wrapper to send template-based email.
2. Ensure no retries (if Postmark returns error, log and return 200 to client? — per spec: log and return failure).

**Micro-steps**

* Create `worker/src/lib/email.ts` with `sendWelcomeEmail({company, email, channelUrl})`.
* Unit test mocking Postmark responses.

---

## M5 — Rate-limiter

**Small steps**

1. Implement in-memory rate-limiter for Worker (per IP and per email) configurable via `RATE_LIMIT`.
2. Expose functions to check and increment.

**Micro-steps**

* Create `worker/src/lib/rateLimiter.ts` using a Map with expiration.
* Tests to simulate bursts and confirm blocking occurs.

Acceptance: blocked requests get structured response code 429.

---

## M6 — Frontend UI

**Small steps**

1. Scaffold React app with TypeScript and Tailwind.
2. Create form, modal, validation hooks, loading states, and dark mode toggle.
3. Implement sanitized-preview mechanism: on modal open, call a lightweight server endpoint `/api/sanitize-preview` to get canonical sanitized name shown in modal.

**Micro-steps**

* `client/src/App.tsx` with form and modal components.
* `client/src/lib/api.ts` with `sanitizationPreview()` and `submit()` functions.
* Visual validation UI, disabled button state, and reset behavior after success.

Acceptance: local dev `yarn start` shows form; modal shows preview returned by the worker.

---

## M7 — Integration

**Small steps**

1. Wire the frontend to POST to `/api/submit` and handle response.
2. Show loading & modal status.
3. Error handling and logging to console for QA.

**Micro-steps**

* Ensure fetch has timeouts and shows fallback messages.
* Clear fields on success; maintain ability to retry with new email.

Acceptance: successful submit triggers Slack+email mock flows via worker stubs.

---

## M8 — Deployment & QA

**Small steps**

1. Create `wrangler.toml` and build pipeline.
2. Document env vars and runbook.
3. Manual QA checklist is executed and recorded.

**Micro-steps**

* `wrangler publish` config file.
* `README.md` with deploy instructions and QA checklist.
* Final end-to-end manual test guide (10 scenarios from Developer Spec).

---

# 5) Prompts for a code-generation LLM (one-by-one, run in order)

> **Instructions for using the prompts**: Feed these prompts sequentially to the code-generation LLM. Wait until each prompt's generated code is added to your repo, then run tests/build before moving to the next prompt. Each prompt assumes previous files exist. Each prompt ends with explicit acceptance tests.

---

## Prompt 0 — Project bootstrap (M0)

```text
You are generating the initial project repository for "conference-slack-form" — a TypeScript monorepo containing two packages: "worker" (Cloudflare Worker, TypeScript) and "client" (React + TypeScript). Produce all necessary configuration and starter files.

Requirements:
- Repo root: package.json with workspace or scripts to run client and worker dev builds.
- Add TypeScript configuration at root and each package (strict mode).
- Add ESLint + Prettier config (recommended rules for TS/React).
- Add Vitest setup and a sample test for the validation utils (empty placeholder is OK for now).
- Create folders: /worker, /client.
- Create README.md with project description and list of env variables required: SLACK_BOT_TOKEN, SLACK_TEAM_ID, SLACK_LOG_CHANNEL_ID, POSTMARK_API_KEY, RATE_LIMIT (number per window), RATE_LIMIT_WINDOW_SEC.
- Add scripts in root package.json:
  - `dev` runs both client and worker dev (for the generator: include a note on how to run them individually).
  - `build`, `start`, `test`, `format`.
- All code must be TypeScript, with `tsconfig.json` set `strict: true`.

Deliverables (files + brief run instructions) and acceptance test:
- Files created: root package.json, tsconfig.json, eslint, prettier, vitest config, /client and /worker skeletons.
- Acceptance: `yarn install` then `yarn run test` should run vitest (even if only placeholder test), and `yarn run dev` prints the two dev commands; explain how to start each service.
```

---

## Prompt 1 — Worker core with routing (M1)

```text
Context: Project repo exists from Prompt 0.

Task: Create a Cloudflare Worker TypeScript project under `/worker` that:
- Serves static files (for production build) and exposes two API endpoints:
  - `GET /api/ping` : returns 200 JSON `{ok:true, version: "0.1.0"}`.
  - `POST /api/submit` : accepts JSON `{companyName: string, email: string}` and returns 400 for invalid JSON shapes and 200 with `{ok:true, id: "<uuid>", sanitizedCompanyName: "<preview>"}` as a stub (sanitization will be implemented next).
- Define environment variable types in `worker/src/types.d.ts` for: `SLACK_BOT_TOKEN`, `SLACK_TEAM_ID`, `SLACK_LOG_CHANNEL_ID`, `POSTMARK_API_KEY`, `RATE_LIMIT`, `RATE_LIMIT_WINDOW_SEC`.
- Add `wrangler.toml` for Cloudflare Worker with build steps referencing the worker folder.
- Add scripts in `/worker/package.json`: `dev` (Miniflare), `build`, `preview`, `test`.
- Implement structured error handling: return JSON errors `{ok:false, errorCode: "...", message: "..."}` with HTTP status codes.

Non-functional requirements:
- No Slack or Postmark calls yet.
- Use `itty-router` or similar lightweight router in worker.
- Use only fetch-compatible APIs; no Node-only libs.

Deliverables & acceptance tests:
- `worker/src/index.ts` with routing handlers.
- `curl` examples in the README showing `GET /api/ping` and `POST /api/submit`.
- Acceptance: `yarn run dev` inside `/worker` then `curl http://localhost:8787/api/ping` returns the expected JSON; `curl -X POST /api/submit -d '{}'` returns 400.
```

---

## Prompt 2 — Sanitization & validation layer (M2)

```text
Context: Worker project exists with /api/submit stub.

Task: Implement server-side validation and sanitization in `worker/src/lib/validation.ts`:
- Use Zod for schema validation:
  - Input shape: `{ companyName: string, email: string }`
  - Email: must match RFC-style email; later we'll block free-email domains but here include a function to test "isFreeEmailDomain(email)" and export it.
- Implement `sanitizeCompanyName(raw: string): string` which:
  - Converts to lowercase.
  - Normalizes accents to ASCII (use `String.prototype.normalize('NFD')` and strip combining marks).
  - Replaces sequences of whitespace with single dashes (`-`).
  - Removes any non-latin letters, numbers, and dashes (strip emojis and symbols).
  - Collapses multiple dashes.
  - Trims leading/trailing dashes.
  - Truncates to 67 characters.
- Export a `validateAndSanitize(input)` function that returns `{ ok: true, value: { companyName, email, sanitizedCompanyName } }` or `{ ok:false, errors }`.
- Add unit tests (Vitest) covering:
  - Accent conversion (e.g., "Café" → "cafe")
  - Emoji and symbol removal ("acme 🚀!" → "acme")
  - Space → dash conversion and collapsing
  - Max length enforced

Integrate with `/api/submit` stub so POST uses `validateAndSanitize` and returns 422 with errors if validation fails; otherwise returns the sanitized preview.

Acceptance:
- Unit tests pass.
- `POST /api/submit` with `{ companyName: "Café 🚀", email: "user@example.com" }` returns 200 with `sanitizedCompanyName: "cafe"`.
```

---

## Prompt 3 — Slack helper module (M3)

```text
Context: Worker has validation + stubs.

Task: Implement `worker/src/lib/slack.ts` — a small wrapper around Slack Web API to:
- Create channel name pattern: `ext-theguild-${sanitizedCompanyName}`.
- `async createChannel(sanitizedName): Promise<{ok:true, channelId, channelName}>`:
  - Try to create channel (`conversations.create` Web API).
  - If name collision (channel exists), append `-2`, `-3`, ... until available; cap attempts at 10 and error otherwise.
- `async inviteGroup(channelId)`: invite the configured team group handle (assume group id or handle provided via env `GUILD_GROUP_ID` — add to types and wrangler example).
- `async inviteGuest(email, channelId)`: create a single-channel guest invite for the email. If Slack API requires invitation via admin API, simulate the expected call and document any necessary scopes. Return structured result.
- `async logToChannel(message, level = "info")`: post a message to `SLACK_LOG_CHANNEL_ID`.

Implementation constraints:
- Use `fetch` to Slack API, include Authorization header `Bearer ${SLACK_BOT_TOKEN}`.
- Respect Slack rate limits: if Slack returns 429, read `Retry-After` header and handle by returning an actionable error (don't implement waiting loops in production; instead surface the 429 via returned object so caller can decide).
- Do not include real token values.

Testing & stubbing:
- Provide a way to inject `fetch` or mock it for unit tests.
- Add unit tests that mock fetch and verify correct endpoints and payload shapes for create channel, invite, and log.

Acceptance:
- Unit tests confirm that on name collision, the helper composes alternative names and calls `conversations.create` multiple times until it gets success (mocked).
```

---

## Prompt 4 — Postmark email module (M4)

```text
Context: Worker project has Slack helper.

Task: Implement `worker/src/lib/email.ts`:
- Add `sendWelcomeEmail({companyName, email, channelName, channelUrl}): Promise<{ok:true}|{ok:false, error}>`.
- Use Postmark API (server-side): make an HTTP call to Postmark's `messages` endpoint with a template or raw HTML. Use `POSTMARK_API_KEY` header.
- No retries on error: if Postmark returns non-200, return `{ok:false, error}` and ensure caller logs to Slack.
- Provide unit tests mocking fetch for success and failure flows.

Requirements:
- Design a simple HTML template in code; in future we may wire Postmark templates, but for now include a minimal inline template with placeholders.
- Ensure no PII leaks in logs (only email prefix + domain logged, or log email but mark as sensitive).

Acceptance:
- Tests simulate a successful Postmark response and an error; `sendWelcomeEmail` returns the correct shape.
```

---

## Prompt 5 — Rate limiter (M5)

```text
Context: Worker has validation, Slack and email modules.

Task: Implement `worker/src/lib/rateLimiter.ts`:
- In-memory rate limiter (Map-based) for Cloudflare Worker that supports:
  - `checkAndIncrement(key, limit, windowSec)`: returns `{allowed: boolean, remaining: number, resetAt: epochMillis}`.
- Provide two uses: per-IP (key `ip:${ip}`) and per-email (key `email:${email}`).
- Wire rate limiter into `/api/submit` so:
  - If either limiter blocks, return `429` with body `{ok:false, errorCode:"rate_limit", message:"Rate limit exceeded", metadata:{type:'ip'|'email', remaining:0}}`.
- Add unit tests simulating bursts and expiry.

Notes:
- This is an in-memory solution suitable for single-instance Cloudflare Worker deployments. Document limitations for multi-instance (no central store).

Acceptance:
- Tests show that after `limit` calls the next call is blocked with `allowed:false`.
```

---

## Prompt 6 — Integrate APIs in submit handler (M1→M5 combined)

```text
Context: Worker now has: validation, slack, email, rateLimiter.

Task: Implement the full `/api/submit` handler in `worker/src/index.ts`:
Flow:
1. Parse JSON body and call `validateAndSanitize`.
2. If invalid => 422 with structured errors.
3. Rate-limit check:
   - Check per-IP with key from request cf object or `x-forwarded-for`.
   - Check per-email.
   - If blocked => 429 as specified earlier.
4. Build channel name and create Slack channel using `createChannel` from slack module.
5. Invite `@guild` group (invoke `inviteGroup`).
6. Invite the single-channel guest `inviteGuest(email, channelId)`.
7. Send Postmark email with channel info (send URL to channel if possible).
8. Log success or any errors to Slack logging channel (always call `logToChannel` for major events).
9. Return `{ok:true, id: submissionId, sanitizedCompanyName, slackChannelId}`.

Error handling rules:
- If Slack channel creation fails => log then return 502 (Slack error).
- If guest invite or group invite fails => log, but still attempt Postmark (specify in log).
- If Postmark fails => still return 200 or 207? Follow original spec: "Sent upon successful submission. No retries; errors logged to Slack." So: if email fails, still return 200 but include `emailSent:false` in response and log details.

Testing:
- Provide unit/integration tests that mock the Slack & Postmark modules to ensure control flow correctness and logging side-effects.

Acceptance:
- POST a valid payload through `/api/submit` with mocks returns `{ok:true, ...}` and calls are made in the expected order (validation -> rate limiter -> slack create -> invites -> email -> log).
```

---

## Prompt 7 — Frontend scaffold + form (M6)

```text
Context: Worker API endpoints exist and provide sanitization preview and submit.

Task: Implement React client under `/client`:
- Tech: React + TypeScript, Tailwind CSS, shadcn components (use simple components if shadcn not available).
- Single page with:
  - Company Name input (autofocus, maxLength 67).
  - Email input.
  - Submit button (disabled when invalid).
  - Modal confirmation that appears on submit:
    - On modal open, call `/api/sanitize-preview` (implement small new Worker endpoint to return `sanitizedCompanyName` using same validateAndSanitize function but without rate-limit increment).
    - Show raw company name, sanitized preview, and email.
    - Confirm/Cancel buttons.
- UX details:
  - Prevent double-submits.
  - Loading indicator on submit.
  - Reset form on success or cancel.
  - Dark mode support via CSS toggle.
  - No animations, no keyboard navigation (explicitly avoid custom keyboard flow).
- Testing:
  - Add a small unit test for the `sanitizePreview` client function (mock fetch) and a smoke test for the `App` renders form.

Acceptance:
- `yarn run dev` for the client opens a dev server and form renders.
- Clicking submit opens modal and modal shows text returned by `/api/sanitize-preview` (mocked in dev if needed).
```

---

## Prompt 8 — Wire frontend submit flow and error handling (M7)

```text
Context: Client scaffold exists and worker endpoints are in place.

Task:
- Implement `client/src/lib/api.ts` with:
  - `sanitizePreview(companyName)` → calls `/api/sanitize-preview` (POST).
  - `submitSubmission({companyName, email})` → POST `/api/submit`.
  - Each function returns structured `{ok, data?, error?}`.
- In `App.tsx`, after user confirms in modal:
  - Show loading state.
  - Call `submitSubmission`.
  - On success: show success message in modal and clear form.
  - On rate-limit (429) show the message and the type (email or ip) in the modal.
  - On Slack error (502) show a generic "submission failed — we're looking into it" message and log to console.
- Ensure no orphaned UI code: all UI components used are imported and referenced.
- Add E2E test plan steps (manual instructions) to validate a successful submission and each major error path.

Acceptance:
- Submit flow calls the worker and reacts correctly to success, rate-limit, and Slack errors (simulate by making the worker return these responses).
```

---

## Prompt 9 — Logging, secrets, and env docs (M8)

```text
Context: Worker and client wired up.

Task:
- Add `worker/.env.example` and `client/.env.example` that list required env variables (no real secrets).
- Write `DEPLOYMENT.md` with:
  - Wrangler publish steps.
  - How to set environment variables in Cloudflare (list of env names).
  - Notes about single-instance in-memory rate limiter limitations.
  - Rollback plan (how to disable Worker quickly).
- Add a `QA_CHECKLIST.md` that includes the 10 manual scenarios from Developer Spec and how to verify each one (curl commands, what to look for in Slack logs, what Postmark should send).
- Add `SECURITY.md` with notes: tokens never exposed client-side, recommended scopes for Slack token, and CORS rules.

Acceptance:
- QA checklist contains clear step-by-step verification for each scenario.
```

---

## Prompt 10 — Final integration & deployment wiring (M8)

```text
Context: All modules exist; tests passing.

Task:
- Produce final wiring and a deployment script:
  - Add `scripts/deploy.sh` that runs `yarn run build` for client, places static assets into worker produce path, builds worker, and runs `wrangler publish`.
  - Ensure `wrangler.toml` references `main` output.
  - Add `worker/src/manifest.json` or static assets mapping if required.
- Create a final smoke test script `scripts/smoke-test.sh` that:
  - Calls `/api/ping`.
  - Posts to `/api/submit` with a test payload and prints the response.
- Update README with step-by-step how to set env vars on Cloudflare and run the smoke tests.

Acceptance:
- `./scripts/deploy.sh` produces a built worker (no real publish required in test), and `./scripts/smoke-test.sh` demonstrates calls to endpoints (mockable in CI).
```

---

## Prompt 11 — Final QA & small polish (M8)

```text
Context: Deployed locally and smoke tests pass.

Task:
- Add final polish:
  - Ensure all TypeScript types exported and used properly.
  - Add small unit tests for:
    - Sanitizer edge cases
    - Rate-limiter expiry
  - Lint the whole codebase and fix issues.
  - Ensure no secret keys are accidentally committed.
- Produce a final `DELIVERABLES.md` listing all files, key entry points, and how to extend the app (e.g., replacing in-memory store with Redis for rate-limiter).
- Provide a final manual runbook for a non-dev person to deploy (copy/paste commands).
- NOTE: If any previous prompt created partial code, make sure you integrate missing imports and wiring so nothing is orphaned.

Acceptance:
- `yarn run lint`, `yarn run build`, and `yarn run test` all succeed locally.
```

---

# 6) Notes on iterating with the LLM

* Run prompts one at a time and run the acceptance tests before moving forward.
* If a generated prompt output diverges, fix immediately and re-run `test` before continuing.
* For Slack API specifics (scopes and single-channel guest invites), if the generator is uncertain, code should implement a clear stub and document the exact Slack scopes required so you can obtain the right token.

---

# 7) Example small-scope execution plan for the next 48 minutes (practical)

1. Run **Prompt 0** to initialize repo (10–15m).
2. Run **Prompt 1** to scaffold worker (10–15m).
3. Run unit tests from Prompt 0/1; fix any pipeline issues (remainder of time).

(You asked for step-by-step tasks and prompts — above prompts are already broken into small tasks and micro-steps you can feed to a code-generation LLM in order.)

---

# 8) Quick checklist (ready-to-use)

* [x] Repo initialized (Prompt 0)
* [x] Worker routes implemented (Prompt 1)
* [x] Sanitization + validation (Prompt 2)
* [x] Slack module (Prompt 3)
* [x] Postmark module (Prompt 4)
* [x] Rate limiter (Prompt 5)
* [x] Submit handler wiring (Prompt 6)
* [x] Client scaffold (Prompt 7)
* [x] Client-wire + error handling (Prompt 8)
* [x] Docs, secrets, QA (Prompt 9)
* [x] Deployment scripts (Prompt 10)
* [x] Final lint/tests/polish (Prompt 11)
