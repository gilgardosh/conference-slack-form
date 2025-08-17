# QA Checklist - Conference Slack Form

This checklist provides step-by-step verification procedures for all manual testing scenarios defined in the Developer Specification.

## Prerequisites

Before running any tests, ensure:

1. **Worker is running:**
   ```bash
   cd worker && npx wrangler dev src/index.ts --port 8787
   ```

2. **Client is running:**
   ```bash
   cd client && yarn run dev
   ```

3. **Application accessible at:** `http://localhost:5173`

4. **Environment variables configured** (see `.env.example` files)

---

## Scenario 1: Valid Submission (Success Flow)

**Objective:** Verify complete end-to-end submission with Slack channel creation and email delivery.

### Steps:
1. **Open the application** at `http://localhost:5173`
2. **Fill in the form:**
   - Company Name: `Acme Corporation`
   - Email: `test@acmecorp.com` (use a real email you control)
3. **Click "Submit"**
4. **Verify modal opens** with:
   - Raw company name: "Acme Corporation"
   - Sanitized channel name: "acme-corporation"
   - Email: "test@acmecorp.com"
5. **Click "Confirm"**
6. **Verify loading state** (spinner + "Submitting..." text)
7. **Wait for completion**

### Expected Results:
- ✅ Success message: "✅ Successfully submitted! Check your email for further instructions."
- ✅ Modal auto-closes after ~2 seconds
- ✅ Form fields are cleared
- ✅ **Slack verification:**
  ```bash
  # Check if channel was created (replace with your workspace)
  curl -H "Authorization: Bearer ${SLACK_BOT_TOKEN}" \
    "https://slack.com/api/conversations.list" | grep "ext-theguild-acme-corporation"
  ```
- ✅ **Email verification:** Check inbox for Postmark email
- ✅ **Slack logs:** Check designated log channel for success entry

### What to Look For:
- **Slack channel:** `ext-theguild-acme-corporation` created
- **Guest invite sent** to provided email
- **@guild team invited** to channel
- **Postmark email delivered** to submitted address
- **Log entry** in Slack log channel with success details

---

## Scenario 2: Invalid Email (Free Provider)

**Objective:** Test validation rejection of free email providers.

### Steps:
1. **Fill in form with:**
   - Company Name: `Test Company`
   - Email: `test@gmail.com`
2. **Click "Submit"**

### Expected Results:
- ❌ Form validation prevents submission
- ❌ Error message appears: "Please use a business email address"
- ❌ Modal does not open
- ❌ No network requests made

### Additional Tests:
Test other free providers:
- `user@yahoo.com`
- `user@hotmail.com`
- `user@outlook.com`

### Verification Commands:
```bash
# Check browser console for validation errors
# Should see client-side validation blocking submission
# No network activity in DevTools Network tab
```

---

## Scenario 3: Invalid Email (Malformed)

**Objective:** Test email format validation.

### Steps:
1. **Test each invalid format:**
   - `invalid-email`
   - `@example.com`
   - `test@`
   - `test@invalid`
   - `test..test@example.com`

2. **For each, fill form and click "Submit"**

### Expected Results:
- ❌ HTML5 validation prevents submission
- ❌ Browser shows native validation message
- ❌ Modal does not open
- ❌ No network requests made

### Verification:
```bash
# Browser will show native validation tooltips
# No entries in Network tab of DevTools
```

---

## Scenario 4: Company Name Too Long

**Objective:** Test company name length validation.

### Steps:
1. **Fill in form with:**
   - Company Name: `This is a very long company name that exceeds the sixty-seven character limit set by the validation rules` (68+ characters)
   - Email: `test@example.com`
2. **Click "Submit"**

### Expected Results:
- ❌ Form validation prevents submission
- ❌ Error message appears near company name field
- ❌ Modal does not open

### Verification Commands:
```bash
# Count characters to verify > 67
echo "This is a very long company name that exceeds the sixty-seven character limit set by the validation rules" | wc -c
```

---

## Scenario 5: Company Name Sanitized to Empty

**Objective:** Test submission blocking when sanitized name becomes empty.

### Steps:
1. **Fill in form with:**
   - Company Name: `!@#$%^&*()_+{}|:"<>?[]\\;',.` (only special characters)
   - Email: `test@example.com`
2. **Click "Submit"**
3. **Check sanitized preview in modal**

### Expected Results:
- ⚠️ Modal opens but shows empty sanitized name
- ❌ "Confirm" button should be disabled
- ❌ Cannot proceed with submission

### Alternative Test:
- Company Name: `🚀🎉✨` (only emojis)

### Verification:
```bash
# Modal should show:
# Raw: "!@#$%^&*()_+{}|:"<>?[]\\;',./"
# Sanitized: "" (empty)
# Confirm button disabled
```

---

## Scenario 6: Duplicate Submission (Same Email)

**Objective:** Test duplicate email rejection.

### Prerequisites:
Complete a successful submission first (Scenario 1).

### Steps:
1. **Fill in form with:**
   - Company Name: `Different Company`
   - Email: `test@acmecorp.com` (same email from Scenario 1)
2. **Click "Submit" → "Confirm"**
3. **Wait for response**

### Expected Results:
- ❌ Error message: "This email has already been used for a submission"
- ❌ Modal stays open for retry
- ❌ No new Slack channel created
- ❌ No new email sent

### Verification Commands:
```bash
# Check Slack channels - should not see duplicate
curl -H "Authorization: Bearer ${SLACK_BOT_TOKEN}" \
  "https://slack.com/api/conversations.list" | grep "ext-theguild-different-company"
# Should return empty (no new channel)
```

---

## Scenario 7: Rate Limit Exceeded

**Objective:** Test rate limiting feedback display.

### Setup:
Temporarily modify worker or submit multiple requests quickly.

### Steps:
1. **Submit multiple valid requests rapidly:**
   - Use different company names but same IP
   - Submit 6+ requests within rate limit window
2. **On rate limit trigger:**
   - Note the error message format
   - Try submitting with different email

### Expected Results:
- ❌ Error message: "Rate limit exceeded (ip rate limit, X remaining)" or "Rate limit exceeded (email rate limit, X remaining)"
- ❌ Modal stays open
- ✅ User can retry with different data
- ✅ **Slack logs:** Rate limit events logged

### Alternative Test (IP Rate Limit):
```bash
# Simulate 429 response by temporarily modifying worker:
# Return 429 status with rate limit metadata
```

### Verification:
```bash
# Check Slack log channel for rate limit notifications
# Should see entries with IP address and attempt details
```

---

## Scenario 8: Slack or Postmark API Failure

**Objective:** Test external service failure handling.

### Setup Options:

**Option A - Invalid API Keys:**
1. Temporarily set invalid `SLACK_BOT_TOKEN` or `POSTMARK_API_KEY`
2. Restart worker

**Option B - Simulate 502 Response:**
```bash
# Temporarily modify worker to return 502:
return new Response(JSON.stringify({
  ok: false,
  message: "Slack service unavailable"
}), { status: 502 });
```

### Steps:
1. **Fill in form with valid data**
2. **Click "Submit" → "Confirm"**
3. **Wait for response**

### Expected Results:
- ❌ Error message: "Submission failed — we're looking into it"
- ❌ Modal stays open for retry
- ✅ **Console:** Error logged to browser console
- ✅ **Slack logs:** Error logged to Slack log channel

### Verification Commands:
```bash
# Check browser console (F12) for 502 error
# Check Slack log channel for error entries
# Should contain: timestamp, email, company name, error details
```

---

## Scenario 9: Modal Behavior Verification

**Objective:** Test modal functionality, display, and interaction.

### Steps:
1. **Test modal opening:**
   - Submit valid form
   - Verify modal appears instantly
   - Verify background is blocked (try clicking behind modal)

2. **Test modal content:**
   - Verify raw company name displays correctly
   - Verify sanitized name shows changes
   - Verify email displays correctly

3. **Test modal interactions:**
   - Click "Cancel" → form should reset, modal closes
   - Click outside modal → should not close
   - Test with various company names requiring sanitization

4. **Test single modal instance:**
   - Try rapid clicking "Submit" → only one modal should appear

### Expected Results:
- ✅ Modal appears instantly on submit
- ✅ Background interaction blocked
- ✅ Content displays correctly
- ✅ Cancel resets form and closes modal
- ✅ Only one modal at a time
- ✅ No animation/title/header

### Verification:
```bash
# Test with sanitization examples:
# "Café Ñoño & Co!" should become "cafe-nono-co"
# "My Company (2024)" should become "my-company-2024"
```

---

## Scenario 10: Dark Mode Appearance

**Objective:** Test UI consistency and readability in dark mode.

### Steps:
1. **Toggle dark mode** using the dark mode button
2. **Verify appearance:**
   - Form styling and contrast
   - Button states (active, disabled, hover)
   - Modal appearance and readability
   - Error and success message visibility
3. **Test complete submission flow in dark mode**
4. **Toggle back to light mode and verify**

### Expected Results:
- ✅ All text is readable with proper contrast
- ✅ Form elements have appropriate dark styling
- ✅ Modal is properly styled for dark mode
- ✅ Success/error messages are clearly visible
- ✅ Toggle between modes works smoothly
- ✅ All functionality works identically in both modes

### Verification:
```bash
# Use browser DevTools to check contrast ratios
# Verify CSS custom properties are properly applied
# Test with browser's accessibility tools
```

---

## Scenario 11: Mobile Responsiveness

**Objective:** Test mobile experience and touch interactions.

### Steps:
1. **Open browser DevTools** (F12)
2. **Toggle device simulation:**
   - iPhone SE (375px width)
   - iPad (768px width)
   - Desktop (1200px+ width)
3. **Test on each size:**
   - Form layout and usability
   - Button touch targets
   - Modal sizing and positioning
   - Complete submission flow
4. **Test actual mobile device if available**

### Expected Results:
- ✅ Form is usable on all screen sizes
- ✅ Modal fits properly on small screens
- ✅ Touch targets are adequately sized (44px minimum)
- ✅ Text is readable without zooming
- ✅ No horizontal scrolling required
- ✅ All interactions work with touch

### Verification Commands:
```bash
# Test with browser device simulation:
# Chrome DevTools → Toggle device toolbar
# Test various viewport sizes and orientations
```

---

## Network Error Testing

**Objective:** Test network connectivity failure handling.

### Setup:
```bash
# Stop the worker service
cd worker
# Kill the wrangler dev process (Ctrl+C)
```

### Steps:
1. **With worker stopped, fill in valid form data**
2. **Click "Submit" → "Confirm"**
3. **Wait for request to timeout**

### Expected Results:
- ❌ Error message: "Network error. Please check your connection and try again."
- ❌ Modal stays open for retry
- ✅ User can restart worker and retry

### Alternative Test:
```bash
# Use browser DevTools:
# Network tab → Throttling → Offline
# Try submission while offline
```

---

## Verification Commands Summary

### Check Slack Integration:
```bash
# List recent channels (requires SLACK_BOT_TOKEN)
curl -H "Authorization: Bearer ${SLACK_BOT_TOKEN}" \
  "https://slack.com/api/conversations.list?limit=20&types=private_channel,public_channel"

# Check specific channel existence
curl -H "Authorization: Bearer ${SLACK_BOT_TOKEN}" \
  "https://slack.com/api/conversations.info?channel=C1234567890"
```

### Check Rate Limiting:
```bash
# Monitor worker logs during testing
npx wrangler tail

# Check browser Network tab for 429 responses
# Look for X-RateLimit headers if implemented
```

### Monitor Application Logs:
```bash
# Worker logs
npx wrangler tail

# Client console logs
# Open browser DevTools → Console tab
```

### Test Data Cleanup:
```bash
# After testing, clean up test channels if needed
# (Manually via Slack interface or API calls)
```

---

## Pass/Fail Criteria

### ✅ Pass Criteria:
- All form validations work correctly
- Successful submissions create Slack channels and send emails
- Error messages are user-friendly and helpful
- Rate limiting provides clear feedback
- Modal behavior is consistent and intuitive
- Both light and dark modes are fully functional
- Mobile responsiveness meets usability standards
- Network errors are handled gracefully

### ❌ Fail Criteria:
- Form allows invalid data submission
- Successful submissions don't create expected resources
- Error messages are confusing or missing
- Rate limiting doesn't work or provides unclear feedback
- Modal behavior is inconsistent or broken
- UI is broken or unreadable in any mode
- Mobile experience is unusable
- Network errors cause application crashes

---

## Reporting Issues

When reporting issues found during QA:

1. **Include specific scenario number**
2. **Provide exact steps to reproduce**
3. **Include browser/device information**
4. **Attach screenshots for UI issues**
5. **Include console error messages**
6. **Note expected vs. actual behavior**

### Example Issue Report:
```
Scenario: 2 (Invalid Email)
Browser: Chrome 120.0.0.0
Issue: Form allows submission with @gmail.com addresses
Steps: Filled form with "test@gmail.com", clicked Submit, modal opened
Expected: Validation should block submission
Actual: Modal opened and allowed confirmation
Console Errors: [paste any errors]
```
