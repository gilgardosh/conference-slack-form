# E2E Test Plan - Conference Slack Form

This document outlines manual testing steps to validate the form submission flow and error handling.

## Prerequisites

1. Start the worker service: `cd worker && npx wrangler dev src/index.ts --port 8787`
2. Start the client: `cd client && yarn run dev`
3. Open the application at `http://localhost:5173`

## Test Cases

### 1. Successful Submission Flow

**Objective**: Validate that a normal submission works end-to-end

**Steps**:

1. Fill in the form with:
   - Company Name: "Test Company Inc."
   - Email: "test@example.com"
2. Click "Submit"
3. Verify the confirmation modal opens
4. Check that "Sanitized Channel Name" shows a cleaned version (e.g., "test-company-inc")
5. Click "Confirm"
6. Verify loading state appears (spinning icon and "Submitting..." text)
7. Wait for submission to complete
8. Verify success message appears in the modal: "✅ Successfully submitted! Check your email for further instructions."
9. Verify the modal closes automatically after ~2 seconds
10. Verify the form is cleared

**Expected Result**: Submission succeeds, success message shows, form resets

---

### 2. Rate Limit Error (IP-based)

**Objective**: Test IP rate limiting error handling

**Setup**:

- Submit multiple requests quickly to trigger IP rate limiting
- Or modify worker code temporarily to return 429 with IP rate limit

**Steps**:

1. Fill in form with valid data
2. Click "Submit" → "Confirm"
3. Immediately after success, submit another request
4. Repeat until rate limit is hit

**Expected Result**:

- Error message shows: "Rate limit exceeded (ip rate limit, X remaining)"
- Modal stays open
- User can retry or cancel

---

### 3. Rate Limit Error (Email-based)

**Objective**: Test email rate limiting error handling

**Setup**:

- Use the same email multiple times
- Or modify worker code temporarily to return 429 with email rate limit

**Steps**:

1. Submit a successful request with email "test@example.com"
2. Try to submit again with the same email

**Expected Result**:

- Error message shows: "Rate limit exceeded (email rate limit, X remaining)"
- Modal stays open
- User can try with different email or wait

---

### 4. Slack Integration Error (502)

**Objective**: Test Slack service error handling

**Setup**:

- Modify worker code temporarily to return 502 status
- Or break Slack configuration to cause real 502 error

**Steps**:

1. Fill in form with valid data
2. Click "Submit" → "Confirm"
3. Wait for submission

**Expected Result**:

- Error message shows: "Submission failed — we're looking into it"
- Error is logged to browser console
- Modal stays open for retry

---

### 5. Validation Errors

**Objective**: Test client-side and server-side validation

**Steps**:

**5a. Empty Fields**:

1. Try to submit with empty company name
2. Try to submit with empty email
3. Try to submit with both empty

**5b. Invalid Email**:

1. Enter invalid email formats:
   - "invalid-email"
   - "@example.com"
   - "test@"
   - "test@invalid"

**5c. Company Name Too Long**:

1. Enter a company name longer than 67 characters

**Expected Result**:

- Form validation prevents submission
- Appropriate error messages show
- Modal does not open for invalid data

---

### 6. Network Error

**Objective**: Test network connectivity issues

**Setup**:

- Stop the worker service
- Or use browser dev tools to simulate network failure

**Steps**:

1. Fill in form with valid data
2. Click "Submit" → "Confirm"
3. Wait for request to fail

**Expected Result**:

- Error message shows: "Network error. Please check your connection and try again."
- Modal stays open for retry

---

### 7. Sanitization Preview

**Objective**: Test company name sanitization preview

**Steps**:

1. Enter company names with special characters:
   - "My Company! 🚀"
   - "Test & Development Inc."
   - "Company (2024)"
   - "Café ñoño"
2. Click "Submit"
3. Check sanitized preview in modal

**Expected Result**:

- Special characters are removed/replaced
- Emojis are removed
- Spaces become hyphens
- Result is lowercase
- Preview loads without errors

---

### 8. Dark Mode

**Objective**: Test UI in both light and dark modes

**Steps**:

1. Toggle dark mode using the toggle button
2. Test all the above scenarios in dark mode
3. Verify all colors and contrasts are appropriate

**Expected Result**:

- All UI elements work correctly in both modes
- Error and success messages are readable
- Modal appearance is consistent

---

### 9. Responsive Design

**Objective**: Test UI on different screen sizes

**Steps**:

1. Test on desktop (1200px+ width)
2. Test on tablet (768px-1199px width)
3. Test on mobile (320px-767px width)
4. Test form submission flow on each size

**Expected Result**:

- Form is usable on all screen sizes
- Modal fits properly on small screens
- Touch interactions work on mobile

---

## Simulation Instructions

To test specific error scenarios, you can temporarily modify the worker response:

### Simulate 429 Rate Limit:

```typescript
// In worker/src/index.ts, replace the submit handler with:
return new Response(
  JSON.stringify({
    ok: false,
    message: 'Rate limit exceeded',
    metadata: { type: 'email', remaining: 2 },
  }),
  {
    status: 429,
    headers: { 'Content-Type': 'application/json' },
  }
);
```

### Simulate 502 Slack Error:

```typescript
// In worker/src/index.ts, replace the submit handler with:
return new Response(
  JSON.stringify({
    ok: false,
    message: 'Slack service unavailable',
  }),
  {
    status: 502,
    headers: { 'Content-Type': 'application/json' },
  }
);
```

### Simulate Network Error:

- Stop the worker service entirely
- Or use browser Dev Tools → Network tab → "Offline" mode

## Notes

- All error messages should be user-friendly
- Console errors should only appear for debugging (502 errors)
- Loading states should be visible during async operations
- Success flows should feel smooth and provide clear feedback
- Form should reset only after successful submission
