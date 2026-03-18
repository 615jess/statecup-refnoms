# Stack Research: Referee Confirmation System

**Project:** State Cup Referee Nominations — Confirmation Milestone
**Researched:** 2026-03-17
**Confidence note:** WebSearch and WebFetch were unavailable during this session. All findings are
from training knowledge of Apps Script (stable platform, APIs below have been consistent since ~2018).
Confidence levels reflect that constraint. Validate quotas against current Google documentation before
assuming they hold exactly.

---

## 1. Email Sending: MailApp vs GmailApp

### What the question is

Two Apps Script services can send email: `MailApp` and `GmailApp`. The choice matters for OAuth
scope, email threading, and operational simplicity.

### MailApp

**Confidence: HIGH** — This is core, well-documented Apps Script behavior.

`MailApp.sendEmail()` is the correct choice for this system.

Key method signature:

```javascript
MailApp.sendEmail(recipient, subject, body, options)
```

The `options` object supports:
- `htmlBody` — full HTML email (use this; plain text falls back automatically if client can't render HTML)
- `replyTo` — set reply-to address (useful for directing referee replies to the assignor)
- `name` — sender display name (e.g., "TN State Cup Referee Program")
- `cc`, `bcc` — carbon copy
- `noReply` — suppress reply-to (set `true` if no-reply behavior is needed)

**Quota (MEDIUM confidence — verify current limits):** Google Workspace accounts get ~1,500 emails/day.
Consumer Gmail accounts get ~100 emails/day. This system has ~50–100 referees per event cycle, so
either tier is adequate. The assignor account running the script determines which quota applies.

**OAuth scope required:** `https://www.googleapis.com/auth/script.send_mail` — narrower than GmailApp.
This scope is simpler to authorize and does not require read access to the Gmail inbox.

### GmailApp

**Confidence: HIGH**

`GmailApp.sendEmail()` has the same basic signature as MailApp, but:
- Requires broader OAuth scope: `https://www.googleapis.com/auth/gmail.send` (or `gmail.compose`)
- Emails are sent FROM and appear IN the sender's Gmail Sent folder (MailApp emails do not)
- Useful if you need to track sent emails in the assignor's Gmail — but that's not a requirement here
- Thread continuation via `GmailApp.getThreadById()` is a GmailApp-only feature — not needed here

### Recommendation: Use MailApp

**Rationale:**
1. Narrower OAuth scope — the script runs as the assignor's account, asking for less permission is safer
   and simpler for onboarding
2. No inbox pollution — sent emails don't pile up in the assignor's Sent folder
3. Fully supports `htmlBody` and `replyTo`, which is all this system needs
4. Simpler — same service already being used (or easily added) to the existing Apps Script

**Do NOT use:** External email services (SendGrid, Mailgun, etc.). The project has no backend
infrastructure for API key management, and Apps Script's MailApp handles the volume fine.

---

## 2. Token Generation in Apps Script

### What the question is

Each referee needs a unique, unguessable token embedded in their confirmation link. The token must be:
- Unique per referee per nomination cycle
- Unguessable (not sequential, not based on row number)
- Reproducible lookup — given a token in a GET request, find the matching spreadsheet row

### Available approaches in Apps Script

**Confidence: HIGH** — These are built-in Apps Script utilities.

#### Option A: `Utilities.getUuid()` (Recommended)

```javascript
const token = Utilities.getUuid();
// Returns: "550e8400-e29b-41d4-a716-446655440000" (RFC 4122 v4 UUID)
```

- Built into Apps Script `Utilities` service — no imports, no dependencies
- Cryptographically random — Google's implementation; not seeded from guessable state
- 122 bits of randomness — practically unguessable for this use case
- Returns a lowercase hyphenated string — URL-safe as-is

**This is the right choice.** It's the simplest, most idiomatic approach in Apps Script.

#### Option B: Manual random string via `Math.random()`

```javascript
// Anti-pattern — DO NOT use
const token = Math.random().toString(36).substr(2) + Date.now().toString(36);
```

- `Math.random()` is NOT cryptographically random in V8 (Apps Script runtime)
- Predictable if the attacker knows the time of generation
- No reason to use this when `Utilities.getUuid()` exists

#### Option C: `Utilities.computeDigest()` (HMAC/hash)

```javascript
const hash = Utilities.computeDigest(
  Utilities.DigestAlgorithm.SHA_256,
  rowId + secretSalt,
  Utilities.Charset.UTF_8
);
```

- Deterministic given the same inputs — allows re-deriving the token without storing it
- Requires managing a secret salt (stored in Script Properties)
- More complexity than `Utilities.getUuid()` for equivalent security at this scale
- Only worthwhile if you can't store tokens in the sheet — which is not a constraint here

### Recommendation: `Utilities.getUuid()` stored in the sheet

Generate a UUID when the nomination row is created (or when the email batch is triggered), write it
to a dedicated "Token" column in the Google Sheet, then look it up on confirmation.

```javascript
function generateAndStoreToken(sheet, row) {
  const token = Utilities.getUuid();
  sheet.getRange(row, TOKEN_COLUMN).setValue(token);
  return token;
}
```

**Token column placement:** Add a "Confirmation Token" column to the existing nominations sheet.
This avoids needing a separate tokens table and keeps data co-located with the nomination row.

**Do NOT:** Use sequential row numbers or referee IDs as tokens. Do not hash the referee's email
address — emails are not secret.

---

## 3. URL Parameter Handling for Token Links

### The confirmation URL structure

The confirmation page will live on GitHub Pages (static HTML, matching existing architecture).
The token is passed as a query parameter.

**Recommended URL pattern:**

```
https://[org].github.io/StateCup_RefNoms/confirm.html?token=550e8400-e29b-41d4-a716-446655440000
```

**Confidence: HIGH** — Standard URL/query parameter approach, no Apps Script-specific risk.

### Generating the URL in Apps Script

```javascript
const BASE_URL = 'https://[org].github.io/StateCup_RefNoms/confirm.html';
const confirmUrl = `${BASE_URL}?token=${token}`;
```

UUIDs from `Utilities.getUuid()` contain only hex digits and hyphens — URL-safe with no encoding needed.

### Reading the token on the confirmation page (static HTML/JS)

```javascript
const params = new URLSearchParams(window.location.search);
const token = params.get('token');
```

`URLSearchParams` is supported in all modern browsers — no polyfill needed for this audience
(soccer assignors and referees using current devices).

### Token validation in Apps Script

When the confirmation page POSTs the token to the Apps Script endpoint:

```javascript
function findRowByToken(token) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Nominations');
  const data = sheet.getDataRange().getValues();
  const tokenCol = COLUMNS.TOKEN; // 0-indexed column number
  for (let i = 1; i < data.length; i++) {
    if (data[i][tokenCol] === token) return i + 1; // 1-indexed sheet row
  }
  return null;
}
```

**Performance note:** At ~50–100 rows per event cycle, a full sheet scan is entirely adequate.
No indexing needed. A binary search or separate index sheet would be premature optimization.

---

## 4. Apps Script Web App GET/POST Handling

### Existing pattern

The current Apps Script handles `doPost(e)` for form submissions. The confirmation system extends
this with:
- `doGet(e)` — token validation endpoint (confirmation page calls this to load referee data)
- `doPost(e)` — already exists; extend to handle confirmation submissions

**Confidence: HIGH** — This is core Apps Script web app behavior.

### doGet for token validation

```javascript
function doGet(e) {
  const token = e.parameter.token;
  if (!token) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: 'No token provided' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const row = findRowByToken(token);
  if (!row) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: 'Invalid or expired token' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Return referee data for pre-filling the confirmation form
  const data = getRowData(row);
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, data }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### doPost extension for confirmations

The existing `doPost` dispatches on an `action` field. Extend that pattern:

```javascript
function doPost(e) {
  const payload = JSON.parse(e.postData.contents);

  if (payload.action === 'confirm') {
    return handleConfirmation(payload);
  }

  // Existing nomination submission logic
  return handleNomination(payload);
}
```

This keeps one deployed URL for both the nomination form and the confirmation page.

### CORS / fetch considerations

Apps Script web apps deployed as "Execute as: Me, Who has access: Anyone" respond with appropriate
headers for cross-origin fetch from GitHub Pages. The existing nomination form already does this
successfully — the confirmation page can follow the identical pattern.

**Do NOT add:** OAuth flows, JWT libraries, or any third-party auth. The token-in-URL pattern
is the right level of security for this use case.

### Deployment model

No new deployment needed if the confirmation POST goes to the same script URL. The assignor
triggers email sends by calling the same web app with `action: 'sendConfirmations'` or via a
custom menu in the Google Sheet.

---

## 5. HTML Email Templates in Apps Script

### MailApp htmlBody option

**Confidence: HIGH**

`MailApp.sendEmail()` accepts an `htmlBody` string. There is no built-in templating engine —
you construct the HTML string directly in JavaScript.

```javascript
function buildConfirmationEmail(referee, confirmUrl) {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: 'Open Sans', Arial, sans-serif; color: #1a2540; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #0d2148; padding: 20px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 22px;">State Cup 2026 — Referee Confirmation</h1>
      </div>
      <div style="padding: 28px 20px;">
        <p>Hi ${referee.firstName},</p>
        <p>You have been nominated to work the <strong>Spring State Cup 2026</strong>.</p>
        <p>Please confirm your availability using the link below:</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${confirmUrl}" style="background: #cc2229; color: #ffffff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
            Confirm My Availability
          </a>
        </div>
        <p style="font-size: 13px; color: #5a6a88;">This link is unique to you. Do not share it.</p>
      </div>
    </body>
    </html>
  `;
}
```

### Template approach: inline strings (Recommended)

**Do NOT use:** HtmlService templates (`.createTemplateFromFile()`) for emails. HtmlService is
designed for web app UI, not email bodies. The output includes `<!DOCTYPE>` scaffolding meant
for iframe-rendered pages, not email clients.

**Do NOT use:** External template engines. The project has no build step, no npm, no module system.

**Recommended pattern:** Simple tagged template literals with direct variable interpolation. For
this use case (one email type, ~5 variable fields) this is the most maintainable approach.
A helper to escape HTML is wise for any user-provided content:

```javascript
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

### Email client compatibility

Inline styles only — no `<style>` blocks, no CSS classes. Email clients (especially Outlook,
Gmail's web client) strip `<style>` tags. Every style rule must be on the element via the `style`
attribute. The existing nomination form's color palette (navy `#0d2148`, red `#cc2229`) translates
directly to inline email styles.

---

## 6. Integration Summary

### What the existing Apps Script already has

Based on the nomination form:
- `doPost(e)` handler writing to Google Sheets
- Server-side input validation
- CORS-compatible response format (`ContentService.createTextOutput`)

### What to add (no new infrastructure)

| Addition | Where | Notes |
|---|---|---|
| `doGet(e)` handler | Same `.gs` file | Token lookup, returns referee data as JSON |
| `generateToken()` | Same `.gs` file | `Utilities.getUuid()` — one line |
| `sendConfirmationEmail()` | Same `.gs` file | `MailApp.sendEmail()` with `htmlBody` |
| `handleConfirmation()` | Same `.gs` file | Writes status back to sheet |
| Token column | Existing Nominations sheet | Add "Confirmation Token" column |
| Status column | Existing Nominations sheet | Add "Confirmation Status" column (Pending/Confirmed/Declined) |
| `confirm.html` | GitHub Pages repo | New static page; same CSS variables as nomination form |

### What NOT to add

| Item | Why Not |
|---|---|
| External email service (SendGrid, etc.) | No infrastructure for API keys; MailApp handles the volume |
| JWT libraries | Token-in-sheet is simpler and adequate; no multi-service auth needed |
| OAuth for referees | Public web app + token IS the auth for this use case |
| Separate Apps Script project | One script handles everything; adds no value to split it |
| Database / Cloud Firestore | Google Sheets is the existing data store; no reason to migrate |
| Node.js / server | Not available; GitHub Pages is static; Apps Script is the backend |
| HtmlService web app | Would require serving the confirmation page FROM Apps Script; GitHub Pages is simpler |
| `clasp` / build pipeline | Not needed for this complexity level; edit in Apps Script IDE |

---

## 7. Confidence Assessment

| Area | Confidence | Basis |
|---|---|---|
| MailApp vs GmailApp comparison | HIGH | Core Apps Script, stable since 2015 |
| MailApp.sendEmail options (htmlBody, replyTo) | HIGH | Core API, unchanged |
| Utilities.getUuid() existence and behavior | HIGH | Documented utility, stable |
| Math.random() not crypto-safe | HIGH | Well-established V8/JS fact |
| doGet/doPost web app pattern | HIGH | Core Apps Script web app model |
| ContentService JSON response | HIGH | Core API |
| Email quota numbers (100/1500) | MEDIUM | Verify against current Google Workspace documentation before relying on these |
| Inline-styles-only email compatibility | HIGH | Email client behavior, not Apps Script specific |
| URLSearchParams browser support | HIGH | Baseline in all modern browsers |

---

## 8. Open Questions (Need Validation Before Build)

1. **Current email quotas:** Verify the assignor account type (personal Gmail vs Workspace). If
   personal Gmail, the 100/day quota is tight if sending to all referees in one batch. Workaround:
   send in batches with `Utilities.sleep()` between sends, or use a Workspace account.

2. **Script execution timeout:** Apps Script functions have a 6-minute timeout. Sending 100 emails
   sequentially should complete well within that, but batch-send logic should be designed to handle
   interruption gracefully (track which rows have been sent).

3. **Token column placement:** Determine the exact column index to add "Confirmation Token" and
   "Confirmation Status" in the existing sheet without breaking existing downstream column references.
   Read the current sheet structure before coding.

4. **Confirm page URL:** The GitHub Pages URL depends on whether the repo is under a user account
   or organization account. This affects the base URL for confirmation links.

5. **Who triggers the email send:** The assignor, via a custom menu in the Google Sheet (using
   `SpreadsheetApp.getUi().createMenu()`), is the most practical trigger. This does NOT require
   re-deploying the web app. Verify this UX with the assignor before building.
