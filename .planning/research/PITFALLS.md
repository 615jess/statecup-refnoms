# Pitfalls Research: Referee Confirmation System

**Domain:** Token-based email confirmation with Google Apps Script + Google Sheets
**Project:** State Cup Referee Nominations
**Researched:** 2026-03-17
**Overall confidence:** HIGH (Apps Script platform behavior is well-established; verified against known platform constraints)

Note on sources: WebSearch and WebFetch were unavailable in this environment. All findings draw from training knowledge of the Apps Script platform (cutoff August 2025). Apps Script platform quotas and behaviors have been stable for several years. Specific quota numbers should be verified against https://developers.google.com/apps-script/guides/services/quotas before implementation.

---

## Category 1: Email Quotas and MailApp Limitations

### Pitfall 1.1: Hitting the MailApp Daily Quota Mid-Send

**What goes wrong:** MailApp has a daily limit of 100 emails per day for personal Google accounts and 1,500 emails per day for Google Workspace accounts. If the assignor triggers emails for all 100 referees at once and the account has already sent some emails that day, the batch will fail partway through. The first N referees get emails; the rest silently do not.

**Why it happens:** Apps Script throws an exception when the quota is exceeded, but a naive loop does not catch this per-referee. The script aborts and leaves partial state — some rows have "Email Sent" status, others don't.

**Consequences:** The assignor thinks all emails were sent. Some referees never receive a confirmation link. The assignor has no way to know who was skipped without manually checking each row.

**Warning signs:**
- Script completes faster than expected for a large batch
- Some referees report never receiving an email
- No error feedback shown in the triggering UI

**Prevention:**
- Wrap each `MailApp.sendEmail()` call in a try/catch inside the loop
- Track which rows failed and return a list of failed sends to the assignor
- Display a count: "47 of 52 emails sent. 5 failed — see rows highlighted in red."
- For 50–100 referees, the quota is unlikely to be hit in a single batch unless it's a personal (non-Workspace) account — confirm which account type the assignor uses before implementation

**Phase:** Core email-send implementation

---

### Pitfall 1.2: Confusing MailApp and GmailApp Quotas

**What goes wrong:** GmailApp has a higher daily quota (1,500 for Workspace, same 100 for personal), but requires the script to run as the user (rather than as a service account). MailApp is simpler but shares the same personal quota. Choosing the wrong service can surprise you.

**Why it happens:** Teams assume GmailApp is always better. But for this project (assignor triggers emails from their own account), MailApp is simpler and appropriate. GmailApp adds complexity with OAuth scopes without benefit.

**Prevention:** Use `MailApp.sendEmail()` for this project. The 100-email personal limit is not a concern if the assignor has a Google Workspace account (Tennessee Soccer organization likely has Workspace). Confirm account type early.

**Phase:** Pre-implementation verification

---

### Pitfall 1.3: Emails Sent Count Against the Account Running the Script

**What goes wrong:** The email quota applies to the Google account that owns the Apps Script project, not the account that triggers it via the web app. If the web app is deployed to "run as: me (the developer)" vs. "run as: the user accessing the web app," this matters for quota attribution.

**Why it happens:** Apps Script web apps can run as the script owner or as the current user. The confirmation email batch trigger will most likely run as the script owner. Verify this is the assignor's account, not a developer's personal account.

**Prevention:** Deploy the web app with "Execute as: Me" and ensure "Me" is the assignor's organizational account. Or have the assignor be the script owner.

**Phase:** Deployment configuration

---

## Category 2: Token Security Issues

### Pitfall 2.1: Using Predictable or Weak Tokens

**What goes wrong:** If tokens are generated as `row_index`, `referee_id`, sequential integers, or even MD5 of name+timestamp, a determined person could guess another referee's token and submit on their behalf.

**Why it happens:** Reaching for the simplest unique identifier (row number, a hash of known values).

**Consequences:** Referee A can confirm for Referee B. For this project, the PROJECT.md explicitly states security is not a major concern, but the assignor still shouldn't want one referee accidentally or intentionally modifying another's record.

**Prevention:** Use a cryptographically random token. Apps Script's `Utilities.getUuid()` returns a random UUID v4 (e.g., `550e8400-e29b-41d4-a716-446655440000`) — 122 bits of randomness. This is sufficient for this use case. Generate once when the row is created (at nomination time or when emails are first triggered) and store in the sheet permanently.

```javascript
// Good token generation
const token = Utilities.getUuid(); // random UUID, not guessable
```

**Phase:** Token generation implementation

---

### Pitfall 2.2: Regenerating Tokens on Every Email Send

**What goes wrong:** If the assignor re-sends emails (e.g., for referees who didn't respond), the system regenerates tokens and overwrites the old ones. Referees who already confirmed via the first email now have a broken link if they try to revisit it.

**Why it happens:** Treating token generation as part of the email-send step rather than as a one-time setup step.

**Prevention:** Generate and store the token once (at nomination time or the first time emails are sent). On re-send, check if a token already exists in the column — if yes, reuse it. Only generate a new token if the cell is empty.

```javascript
// In Apps Script
const existingToken = sheet.getRange(row, TOKEN_COL).getValue();
const token = existingToken || Utilities.getUuid();
if (!existingToken) {
  sheet.getRange(row, TOKEN_COL).setValue(token);
}
```

**Phase:** Token generation and email-send implementation

---

### Pitfall 2.3: No Token Expiry — By Design, But Needs Explicit Decision

**What goes wrong:** Without expiry, confirmation links work indefinitely. This is acceptable for this project (the assignor closes confirmations manually), but the system should prevent submissions after the assignor has closed the confirmation window.

**Why it happens:** "No expiry" sounds simple, but without a mechanism to reject late submissions, a referee who bookmarks the link could still submit changes days after the assignor has finalized assignments.

**Prevention:** Store a "confirmations open" flag in the sheet (a cell the assignor sets to FALSE when closing confirmations). The doGet handler checks this flag and returns an appropriate "closed" response when FALSE. This is simpler than per-token expiry and fits the manual workflow.

**Phase:** Confirmation close/lock implementation

---

### Pitfall 2.4: Token Exposed in Server Logs

**What goes wrong:** Apps Script execution logs record the full URL of incoming requests, including query parameters. If anyone has access to the script's log output (other editors on the project), they can extract tokens.

**Why it happens:** Treating the token as a secret when it's sent in a URL.

**Consequences:** For this project, the script is likely only accessible to the assignor/developer. This is LOW severity given the stated security requirements, but worth noting.

**Prevention:** Restrict script editor access to only necessary people. Consider noting in documentation that the Apps Script project should not be shared as an "Editor" with untrusted parties.

**Phase:** Security review / deployment

---

## Category 3: Apps Script Web App Deployment Gotchas

### Pitfall 3.1: New Deployment Required for Every Code Change

**What goes wrong:** Apps Script web apps are versioned. When you edit the code, the live `/exec` URL continues serving the old version until you explicitly create a new deployment. The `/dev` URL always runs the latest code but requires authentication and is only accessible to editors.

**Why it happens:** Developers test with `/dev`, make changes, and forget to redeploy. The production URL silently serves stale code.

**Warning signs:**
- Bug fixes don't take effect
- New features don't appear
- "It works in my test but not in production"

**Prevention:**
- Always create a new deployment (not re-deploy) when pushing changes to production
- Keep a record of the current deployment ID in the project README
- Test via the production `/exec` URL, not just `/dev`, before telling the assignor it's ready
- The existing nomination form already has this pattern — follow the same deployment discipline for the confirmation system

**Phase:** Every iteration during development

---

### Pitfall 3.2: CORS and the no-cors Fetch Pattern

**What goes wrong:** Apps Script web apps return a `302 redirect` to a `googleusercontent.com` domain before returning the actual response. Standard `fetch()` with `mode: 'cors'` (the default) will fail because the redirect URL doesn't send CORS headers that allow the originating GitHub Pages domain.

**Why it happens:** The existing nomination form works around this with `fetch(SHEET_URL, { method: 'POST', body: JSON.stringify(data) })` — note there is no explicit `mode` set, which means the browser uses the default. Looking at the existing code, it uses a POST without specifying mode, which works because Apps Script handles the CORS preflight for POST requests differently (or the response is opaque and the script uses it anyway).

**The actual situation:** For the confirmation system, there will be two request types:
1. GET request to fetch referee data pre-filled from token (used on page load)
2. POST request to submit the confirmed data

GET requests via `fetch()` from GitHub Pages to Apps Script will hit the same CORS issue. The safest pattern is to use `no-cors` mode for POST (you get an opaque response, which is fine if you just need to know it succeeded), but for GET you need actual response data — which requires the Apps Script to return proper CORS headers.

**Prevention:** In doGet, explicitly set CORS headers on the ContentService response:
```javascript
function doGet(e) {
  const output = ContentService
    .createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
  // Apps Script automatically adds CORS headers for GET requests
  // when returning ContentService output — verify this in testing
  return output;
}
```

Apps Script automatically adds `Access-Control-Allow-Origin: *` for ContentService responses. This means standard `fetch()` GET requests work. The CORS issue only appears when using HTML output or redirects. **Test this explicitly** during development — do not assume it works without verifying in the actual GitHub Pages context.

**Warning signs:**
- `fetch()` in browser console shows "CORS error" or "opaque response"
- Response is received but `.json()` throws on parsing

**Phase:** First integration between GitHub Pages confirmation page and Apps Script

---

### Pitfall 3.3: Access Control Set to "Anyone" vs. "Anyone with a Link"

**What goes wrong:** Apps Script web apps have two access modes: "Anyone" (public, no Google account required) and "Anyone with Google account." The confirmation links will be sent to referees who may not have Google accounts (or shouldn't need to log in). If the web app is set to require a Google account, referees without one will see a login prompt instead of the confirmation form.

**Prevention:** Deploy with access "Anyone" (no sign-in required). The token in the URL provides the identity; Google sign-in is not needed and adds friction.

**Phase:** Initial deployment configuration

---

### Pitfall 3.4: doGet vs. doPost Routing — Silent Failures

**What goes wrong:** Apps Script web apps route to `doGet(e)` for GET requests and `doPost(e)` for POST requests. A common mistake is handling both in one function, or mixing up which requests go where, or not returning a proper ContentService response from one of the handlers.

**Specific mistakes:**
- Returning a plain object instead of `ContentService.createTextOutput(JSON.stringify(data))` — Apps Script will throw a "Cannot convert [Object] to text" error
- Not checking `e.parameter` vs. `e.postData.contents` — GET params are in `e.parameter`, POST body is in `e.postData.contents`
- Using `return;` without a value in an error path — returns an empty response, which the client treats as success

**Prevention:**
```javascript
// GET — reads referee data by token
function doGet(e) {
  const token = e.parameter.token;
  if (!token) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: 'Missing token' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  // ... fetch data ...
}

// POST — writes confirmation
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  // ... write to sheet ...
}
```

Always return a ContentService response from every code path. Never return undefined or a plain object.

**Phase:** Apps Script routing implementation

---

### Pitfall 3.5: The Existing Deployment URL Is a Different Endpoint

**What goes wrong:** The confirmation system needs to add new routes (doGet for token lookup, plus potentially a new action type in doPost). The existing Apps Script at the nomination endpoint already handles POST for nominations. If the confirmation logic is added to the same script file without care, existing doPost behavior could be broken.

**Why it happens:** The path of least resistance is to add `if (action === 'confirm')` branches to the existing doPost. But modifying the existing handler risks breaking nominations.

**Prevention:**
- Add the new routes carefully — use a `action` field in the POST body to route between nomination and confirmation
- Test the nomination flow after every change to the Apps Script
- Consider whether confirmation logic belongs in the same script file or a separate deployment (two deployments = cleaner separation but more to manage)
- Recommendation: Keep one script, use action-based routing, test nominations thoroughly after each Apps Script change

**Warning signs:**
- Nomination form starts returning errors after adding confirmation code
- The doPost function has no routing logic (handles everything as a nomination)

**Phase:** Integration with existing Apps Script

---

## Category 4: Google Sheets as Data Store

### Pitfall 4.1: Race Conditions on Concurrent Writes

**What goes wrong:** If two referees click Submit on their confirmation pages within milliseconds of each other, two Apps Script executions run simultaneously. Both read the sheet, both find the row, both write to it. One write overwrites the other.

**Why it happens:** Apps Script executions are concurrent — multiple can run in parallel against the same spreadsheet.

**Severity for this project:** LOW. With 50–100 referees, simultaneous confirmation submissions are possible but unlikely. The window for conflict is narrow (both people must be on the confirmation page simultaneously and both click Submit within the same second). Treating it as a known risk rather than building full LockService protection is reasonable.

**Prevention (pragmatic):** Use `LockService.getScriptLock()` around write operations. A 10-second wait timeout is sufficient:

```javascript
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // wait up to 10s
  try {
    // find row, write data
  } finally {
    lock.releaseLock();
  }
}
```

**Note:** LockService adds ~100–200ms to each request. Given the low likelihood of concurrent writes in this project, the tradeoff is acceptable. Implement it as a precaution — it's a one-liner addition.

**Phase:** Confirmation write implementation

---

### Pitfall 4.2: Finding the Right Row by Token — Using getValues() Correctly

**What goes wrong:** A common pattern for token lookup is to loop through all rows calling `getRange(i, tokenCol).getValue()` inside the loop. This makes one API call per row. For 100 rows, that's 100 API calls — Apps Script's Sheets API calls are expensive (each takes 50–200ms). The function hits the 6-minute execution limit or just runs slowly.

**Why it happens:** Using the cell-by-cell API instead of batch reading.

**Prevention:** Read all token data in one call, then search in JavaScript:

```javascript
function findRowByToken(sheet, token, tokenColIndex) {
  const data = sheet.getRange(1, tokenColIndex, sheet.getLastRow(), 1).getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === token) return i + 1; // 1-indexed row number
  }
  return -1; // not found
}
```

This is one API call regardless of sheet size. For 100 rows, it's trivially fast.

**Phase:** Token lookup implementation

---

### Pitfall 4.3: Sheet Structure Changes Break the Apps Script

**What goes wrong:** The Apps Script references columns by index number (e.g., column 5 is "Referee Email"). If the assignor or developer inserts/reorders columns in the spreadsheet, the column indices shift and the script writes data to wrong columns silently.

**Why it happens:** Using hardcoded column numbers is the default pattern in Apps Script.

**Consequences:** Token written to "Availability" column, confirmation status written to "Phone" column. Silent data corruption.

**Prevention:**
- Use named constants for all column indices at the top of the script: `const TOKEN_COL = 15; const CONFIRMATION_STATUS_COL = 16;`
- Document the expected column layout in a comment block at the top of the script
- Consider a helper that finds columns by header name on first run (more robust but adds complexity — probably overkill for this scale)
- Coordinate with the assignor: the sheet layout should be frozen before implementing the script

**Warning signs:** Confirmation status appears in wrong columns, token lookup always returns "not found"

**Phase:** Planning the sheet column layout before writing any script code

---

### Pitfall 4.4: Using getLastRow() When Rows Have Gaps

**What goes wrong:** `sheet.getLastRow()` returns the index of the last row with any content. If rows are deleted or there are empty rows in the middle of the data, `getLastRow()` may not represent the actual last data row, and loops may skip valid rows or include empty ones.

**Severity for this project:** LOW. Nominations are appended sequentially by the existing script; gaps shouldn't occur in normal operation.

**Prevention:** Filter out empty rows when iterating data. After reading a range with `getValues()`, skip rows where the identifier column (e.g., referee first name) is empty.

**Phase:** Data iteration implementation

---

## Category 5: Email Deliverability

### Pitfall 5.1: Confirmation Emails Landing in Spam

**What goes wrong:** Emails from Apps Script via MailApp are sent from the script owner's Gmail/Workspace account. They are legitimate emails, so spam rate is generally low. However:
- Emails with "click this link" and a long Google script URL can trigger spam filters
- Plain-text emails with only a URL look phishing-like to filters
- If the referee's email provider is aggressive (institutional email, school accounts), spam rates are higher

**Prevention:**
- Use HTML email format with proper context: organization name, referee's name (personalized), explanation of purpose
- Include the referee's name and the tournament name in the subject line: "State Cup 2026 — Confirmation Needed: [First Name] [Last Name]"
- Keep the "From" display name recognizable: use the assignor's name, not a generic script address
- Tell referees to expect the email and check spam — mention this in DRA communications
- The `MailApp.sendEmail()` signature supports `name` parameter for display name:
  ```javascript
  MailApp.sendEmail({
    to: email,
    subject: `State Cup 2026 — Confirmation Needed`,
    htmlBody: htmlContent,
    name: 'Jess Erickson — State Cup Assignor'
  });
  ```

**Phase:** Email template implementation

---

### Pitfall 5.2: HTML Email Rendering in Gmail vs. Outlook vs. Apple Mail

**What goes wrong:** Complex CSS in HTML emails (Flexbox, CSS Grid, CSS variables like `var(--navy)`) does not render in most email clients. Gmail strips `<style>` blocks. Outlook uses Word's HTML renderer.

**Why it happens:** Web developers write CSS the same way in emails as on web pages.

**Consequences:** The email looks broken — no colors, no layout, just unstyled text.

**Prevention:**
- Use table-based layout for email (not Flexbox/Grid)
- Use inline styles only — no `<style>` blocks, no CSS classes
- CSS variables (`var(--navy)`) do not work in email — use literal hex values
- The confirmation email should be simple: header, referee name, brief explanation, a large obvious button with the confirmation link, and a plain-text fallback URL
- Test in at least Gmail (web), Apple Mail, and Outlook if possible

**Recommended approach for this project:** Keep the email simple. A white background, navy header with organization name, brief text, one large red "Confirm My Availability" button, and the raw URL below it as a text fallback. No fancy layout needed.

**Phase:** Email template implementation

---

### Pitfall 5.3: Confirmation Link URL Length

**What goes wrong:** The confirmation URL structure is:
`https://[github-pages-url]/confirm.html?token=[UUID]`

A UUID is 36 characters. The GitHub Pages URL is probably 50–80 characters. Total URL length is ~120–150 characters. This is well within all email client and browser limits (browsers support URLs up to 2,000+ characters; email clients typically handle 1,000+ characters in links).

**Verdict:** URL length is NOT a concern for this project. UUID tokens are short enough that no truncation risk exists.

**Phase:** N/A (non-issue)

---

## Category 6: Apps Script Execution Time Limits

### Pitfall 6.1: Hitting the 6-Minute Execution Limit on Batch Email Send

**What goes wrong:** Apps Script executions time out after 6 minutes (30 minutes for Workspace accounts). Sending 100 emails with MailApp takes approximately 100–300ms per email = 10–30 seconds total. This is within the 6-minute limit with room to spare.

**Verdict:** NOT a concern for this project at 50–100 referees. The execution time risk becomes relevant only if each email requires complex Sheet lookups before sending, which would add time.

**Prevention (precautionary):** Batch the token generation and email sending in one pass — read all rows once with `getValues()`, generate/store tokens in bulk with `setValues()`, then send emails. Avoid alternating between Sheet reads and MailApp calls in a row-by-row loop if it can be avoided.

**Phase:** Email send implementation

---

### Pitfall 6.2: Execution Time Limit on doGet/doPost Requests

**What goes wrong:** Each web app request (doGet, doPost) also has the 6-minute timeout, but more practically, users expect a response within 5–10 seconds. If the token lookup, Sheet read, and response construction take more than a few seconds, the user experience degrades.

**Prevention:** The batch-read pattern (read all values at once with `getRange().getValues()`) keeps Sheet API calls to a minimum. For a 100-row sheet, total execution time for a token lookup + row read + write should be under 1–2 seconds in practice.

**Warning signs:** Users report "spinning" on the confirmation page for a long time before data loads.

**Phase:** Performance testing during development

---

## Category 7: Confirmation Page — Mobile Responsiveness

### Pitfall 7.1: Confirmation Links Opened on Mobile

**What goes wrong:** Referees will receive the email on their phone and tap the confirmation link directly. If the confirmation page is not mobile-responsive, the form will be unusable.

**Why it matters:** The existing nomination form is mobile-responsive (uses `@media(max-width:560px)` breakpoints). The confirmation form must match this.

**Prevention:**
- Include `<meta name="viewport" content="width=device-width, initial-scale=1.0">` (same as existing form)
- Use the same grid breakpoints as the nomination form: `@media(max-width:560px)`
- Weekend availability checkboxes are particularly important to test on mobile — tap targets must be large enough
- Test on actual mobile devices or Chrome DevTools mobile emulation before marking complete

**Phase:** Confirmation page HTML/CSS implementation

---

### Pitfall 7.2: Pre-fill Data Not Loading Before Page Renders

**What goes wrong:** The confirmation page fetches referee data via GET request on page load. If the JavaScript `fetch()` is slow (Apps Script cold start can add 1–3 seconds), the page shows an empty or skeleton form while data loads. On mobile with slower connections, this is more pronounced.

**Prevention:**
- Show a loading state while fetching (spinner or "Loading your confirmation details...")
- Disable the form submit button until data is loaded and validated
- Handle the error case explicitly: if token is invalid or fetch fails, show a clear error message rather than an empty form

**Phase:** Confirmation page JavaScript implementation

---

## Category 8: Integration with Existing System

### Pitfall 8.1: The Token Column Must Be Added to the Existing Sheet Without Breaking the Existing Script

**What goes wrong:** Adding a "Token" column to the existing nominations sheet will shift column indices if inserted before the last column, breaking the existing Apps Script's column references.

**Prevention:**
- Add the token column (and any other new columns: confirmation status, confirmation timestamp, referee notes) at the end of the existing data columns
- Append, never insert, when adding new columns to an in-use sheet
- Verify the existing nomination form still works after adding columns

**Warning signs:** Existing nominations start writing to wrong columns after columns are added

**Phase:** Sheet schema planning — must be done before any code is written

---

### Pitfall 8.2: The Existing Apps Script May Need Authorization Re-Approval

**What goes wrong:** Adding new functionality (like reading from the sheet in doGet, or sending email) to the existing Apps Script may require re-authorization if new OAuth scopes are needed. The assignor may need to click through an authorization dialog again.

**Why it happens:** Apps Script requests OAuth scopes when first deployed. Adding `MailApp` usage to a script that previously only used `SpreadsheetApp` triggers a scope change.

**Prevention:**
- Confirm which services are already authorized in the existing script
- The existing script already uses SpreadsheetApp (for writing nominations) and likely sends some email — check the existing script's manifest or test permissions
- After adding MailApp, the assignor will need to re-authorize before emails can be sent — plan for this in the deployment checklist

**Phase:** Deployment and authorization

---

### Pitfall 8.3: Confirmation Status Column Managed by Two Actors

**What goes wrong:** The assignor can manually edit the confirmation status column in the sheet (e.g., override a "Pending" to "Confirmed" for a referee they spoke with by phone). Simultaneously, a referee submitting via the confirmation form also writes to that column. If the assignor's manual edit is overwritten by a late submission, data is lost.

**Why it happens:** No locking mechanism prevents referee form submissions after the assignor has manually overridden a status.

**Prevention:**
- When the assignor closes confirmations (sets a global "confirmations closed" flag), the doPost handler rejects any new submissions
- Document to the assignor that manual edits to the confirmation status column should be made after closing the confirmation window, not during

**Phase:** Confirmation close/lock implementation

---

## Summary: Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Sheet schema design | Adding columns in wrong order breaks existing script | Append new columns at the end; test nomination form after |
| Token generation | Predictable tokens, token overwritten on re-send | Use `Utilities.getUuid()`; only generate if column is empty |
| Apps Script deployment | Code changes not live on /exec URL | Always create new deployment; test against /exec |
| Apps Script routing | doGet/doPost confusion; returning wrong response types | Return ContentService from every code path; use e.parameter for GET, e.postData.contents for POST |
| Email send batch | Partial failure leaves unknown state | Wrap each send in try/catch; report failed sends to assignor |
| Email template | HTML/CSS not rendering in Gmail | Inline styles only; hex colors; no CSS variables; table layout or minimal CSS |
| GitHub Pages → Apps Script | CORS error on GET requests | Verify ContentService GET responses include CORS headers; test in browser from GitHub Pages domain |
| Confirmation page load | Empty form on mobile while fetch is slow | Loading state; disable submit until data loaded |
| Mobile form UX | Tap targets too small; form unusable on phone | Test on mobile emulator; match existing form's responsive breakpoints |
| Concurrent submissions | Two referees submitting simultaneously | Add LockService.getScriptLock() as one-liner precaution |
| Confirmation close | Late submissions overwrite assignor manual edits | "Confirmations closed" flag checked in doPost |
| Re-authorization | New OAuth scopes require assignor to re-approve | Identify all required scopes upfront; plan for auth step in deployment |

## Critical Pitfall Ranking (for this project)

1. **Sheet column order** — Breaking existing nominations is the highest-consequence mistake; silent data corruption
2. **Deployment versioning** — Bugs that appear fixed but are not; frustrating to debug
3. **Token re-generation on re-send** — Broken links for referees who haven't yet confirmed
4. **Email HTML rendering** — Broken email appearance undermines trust in the system
5. **CORS on GET requests** — Confirmation page completely non-functional until resolved
6. **Missing error reporting on batch email send** — Assignor has false confidence that all emails were sent
