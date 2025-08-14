# Developer Specification: Conference Slack Channel Form App

## 1. Overview

Build a **React single-page application** served directly via a **Cloudflare Worker** that enables potential clients at a conference to:

1. Submit their **company name** and **email**.
2. Automatically create a **single-channel Slack channel** in your workspace.
3. Invite the client to Slack as a **single-channel guest**.
4. Send a **custom branded email** via Postmark.
5. Log all relevant events to a **designated Slack channel**.

The app is **fully serverless**, lightweight, responsive, and supports **dark mode**.

---

## 2. Architecture

### 2.1 Frontend

* **React (single-page)**
* **Tailwind + shadcn** for styling
* **Responsive design** for mobile and desktop
* **Dark mode support**
* Form components:

  * Company Name input
  * Email input
  * Submit button (with disabled/active styling)
  * Loading indicator
  * Modal confirmation dialog

### 2.2 Backend / Cloudflare Worker

* Serves the React app
* Exposes **API endpoint** to handle:

  * Form submission
  * Sanitization and validation
  * Slack channel creation
  * Slack user invites
  * Postmark email sending
  * Logging events to Slack
* Handles **rate-limiting per IP and per email**
* Queues submissions in-memory per request

### 2.3 External Services

* **Slack API**

  * Create channels in workspace
  * Invite clients as single-channel guests
  * Invite fixed team group (`@guild`)
* **Postmark**

  * Send custom branded email
* **Slack logging channel**

  * Capture errors and successful events

---

## 3. Functional Requirements

### 3.1 Form

* **Inputs**

  * Company Name (max 67 chars, required)
  * Email (required, valid, non-free email)
* **Autofocus** on company name field
* **Visual input validation**
* **Rate-limit feedback** shown in modal and near form
* **Prevents multiple submissions** while processing
* **Supports copy-paste and autofill**
* **LTR only**
* **Reset form fields** after submission or modal cancel
* **Loading indicator** on form and modal
* **Touch/mouse input** only

### 3.2 Modal Confirmation

* Appears instantly
* Blocks background interaction
* Shows:

  * Raw company name
  * Sanitized company name
  * Email
* Confirm and Cancel buttons
* Recomputes sanitized company name when opened
* Displays **success message** after successful submission
* Requires manual close (user click)
* Clears content on close
* Single modal at a time
* Visual feedback while processing
* No animation, title, or header

### 3.3 Sanitization Rules

* Company name:

  * Lowercase
  * Standard Latin letters only
  * Spaces → dashes
  * Accented letters → non-accented equivalents
  * Remove emojis and other symbols
* Email:

  * Trim leading/trailing whitespace
  * Sanitize only if security risk detected

### 3.4 Validation Rules

* Company name: max 67 characters, non-empty after sanitization
* Email: valid format, not free email domain (Gmail, Yahoo, Hotmail, etc.)
* Prevent duplicate submissions per email

### 3.5 Slack Integration

* Channel naming: `ext-theguild-${sanitizedCompanyName}`
* Collision handling: append numbers at the end
* Invite `@guild` team group
* Single-channel guest invite
* Uses **default Slack invite text**
* Logs successes and errors to Slack

### 3.6 Email Integration

* Postmark static email template
* Sent upon successful submission
* No retries; errors logged to Slack

### 3.7 Rate-Limiting

* Configurable via **environment variable**
* Enforced per IP and per email
* Independent of submission success/failure

---

## 4. UI / UX Requirements

* Single screen, minimal style
* Displays company logo (preloaded)
* Loading indicator on submission
* Success message only in modal
* Dark mode compatible
* Modal blocks background interaction
* Submit button visually distinguishes disabled state
* ARIA accessibility attributes included
* Visual feedback for invalid inputs
* No keyboard navigation (mouse/touch only)
* Standard scrolling and tapping on mobile
* No terms/privacy or inline hints
* No character counter
* No tooltips
* Fields cleared on cancel or success
* Users can retry immediately with a new email if blocked

---

## 5. Data Handling

* Sanitization and validation **server-side**
* Submissions handled **ephemerally in memory per request**
* No persistent database
* Logs in **designated Slack channel**

  * Includes email, raw and sanitized company name, success/error

---

## 6. Error Handling

* Slack channel/email creation failures logged with **generic error message**
* Rate-limit exceeded: message shown in modal and form, also logged
* Network errors: logged to Slack, no user feedback
* Modal failures: negligible, no logging
* Submission blocked if sanitized company name is empty
* Duplicate email submissions rejected

---

## 7. Security

* Email sanitized for security risks
* Rate-limiting prevents abuse
* Environment variables for API keys
* Slack API tokens and Postmark keys **never exposed to client**
* Only serverless architecture (Cloudflare Worker) handles sensitive operations

---

## 8. Testing Plan

* **Manual testing** only (no automated tests required)
* Scenarios:

  1. Valid submission (Slack channel creation + email)
  2. Invalid email (free provider, malformed)
  3. Company name too long
  4. Company name sanitized to empty → submission blocked
  5. Duplicate submission → rejected
  6. Rate-limit exceeded → feedback shown
  7. Slack or Postmark API failure → logged only
  8. Modal behavior (open/close, display content, single instance)
  9. Dark mode appearance
  10. Mobile responsiveness and touch feedback

---

## 9. Environment Variables

* `SLACK_BOT_TOKEN` – for channel creation and invites
* `SLACK_TEAM_ID` – workspace/team ID
* `POSTMARK_API_KEY` – for sending emails
* `RATE_LIMIT` – max submissions per IP/email per interval

---

## 10. Deliverables

* **Cloudflare Worker** hosting React app and backend logic
* React SPA (Tailwind + shadcn)
* Slack integration for channel creation & invites
* Postmark integration for custom email
* Logging mechanism to Slack channel
* Full UX flow with modal confirmation and loading indicators
* Documentation for environment variables and deployment
