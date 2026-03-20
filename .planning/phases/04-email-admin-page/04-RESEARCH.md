# Phase 4: Email Admin Page + getAllNominees - Research

**Researched:** 2026-03-20
**Domain:** Static HTML admin page + Google Apps Script backend (getAllNominees + markSent endpoints)
**Confidence:** HIGH — all critical patterns already proven in Phase 2 and Phase 3 of this same project

## Summary

Phase 4 builds an assignor-facing admin page (static HTML on GitHub Pages) that fetches all nominee rows from a new `getAllNominees` Apps Script endpoint, displays them in a sortable/filterable table, and provides mailto links that auto-mark each referee's status as Sent via a `markSent` API call before Outlook opens.

The critical technical domains — CORS-safe fetch from GitHub Pages to Apps Script, Apps Script doGet/doPost pattern, column writes with LockService, the project's CSS design system — are all already established by Phase 2 and Phase 3. This phase follows those exact patterns. No new libraries or architecture patterns are introduced. The only new complexity is the mailto URL construction and the two-file Apps Script structure.

This is a relatively low-risk phase because every technical primitive is already working in production. The main implementation decisions (email body character budget, table sort/filter in vanilla JS, in-place row update vs reload) are design choices, not research unknowns.

**Primary recommendation:** Follow Phase 3 patterns exactly (same fetch approach, same GAS structure, same CSS variables). Write `adminemail.gs` as a new file in the same Apps Script project. Keep the admin page HTML self-contained with vanilla JS — no external libraries needed.

## Standard Stack

The established approach for this project, proven in Phases 2 and 3:

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Google Apps Script | Current (V8 runtime) | Backend endpoint + spreadsheet writes | Already running in production; same project as nominatev2.gs and refdetails.gs |
| Static HTML + vanilla JS | N/A | Admin page UI | No framework needed; matches existing DRA form and referee form pattern |
| GitHub Pages | N/A | Host admin page | Already hosts other Phase HTML files |
| PropertiesService | Built-in GAS | Read tournament constants (WEEKEND_1_DATES, WEEKEND_2_DATES, ASSIGNOR_EMAIL) | Already used in Phase 3 |
| LockService | Built-in GAS | Serialize concurrent markSent writes | Same pattern as nominateV2 and submitDetails |
| ContentService | Built-in GAS | Return JSON from doGet / doPost | Same `_jsonResponse` helper already in nominatev2.gs |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| encodeURIComponent() | Browser built-in | Encode mailto subject + body | All mailto URL construction |
| Open Sans (Google Fonts) | Current | Typography | Match existing page style |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vanilla JS table sort | DataTables, List.js | CDN dependency adds loading risk; vanilla is 20 lines and sufficient for a table under 100 rows |
| Vanilla JS fetch | jQuery AJAX | jQuery is overkill; fetch API is already used in Phases 2 and 3 |

**Installation:** No npm/CDN dependencies beyond what existing pages already use. Only addition is `https://fonts.googleapis.com/css2?family=Open+Sans:...` (already in all existing pages).

## Architecture Patterns

### Recommended Project Structure

New file in scripts/:
```
scripts/
├── nominatev2.gs       # Phase 2 — doPost handler, _jsonResponse, setTournamentConstants
├── refdetails.gs       # Phase 3 — doGet handler, _handleGetDetails, _handleSubmitDetails
└── adminemail.gs       # Phase 4 — _handleGetAllNominees, _handleMarkSent (NEW)
```

New HTML file at project root:
```
admin.html              # Phase 4 admin page (NEW)
```

### Pattern 1: Apps Script Action Dispatch (Proven in Phase 3)

`adminemail.gs` does NOT re-declare `doGet` or `doPost` — those entry points are already in `refdetails.gs` and `nominatev2.gs`. GAS compiles all `.gs` files in a project together into one scope, so helper functions declared in `adminemail.gs` are callable from the existing entry points.

The existing `doGet` in `refdetails.gs` must be extended to branch on `e.parameter.action`:

```javascript
// In refdetails.gs — extend existing doGet to route getAllNominees
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';

    if (action === 'getAllNominees') {
      return _handleGetAllNominees();
    }

    // Existing token-based lookup (Phase 3)
    var token = (e && e.parameter && e.parameter.token)
      ? e.parameter.token.trim()
      : '';

    if (!token) {
      return _jsonResponse({ ok: false, error: 'missing_token', message: 'No token provided.' });
    }
    return _handleGetDetails(token);

  } catch (err) {
    Logger.log('doGet error: ' + err.message);
    return _jsonResponse({ ok: false, error: 'server_error', message: 'An internal error occurred.' });
  }
}
```

Similarly, `doPost` in `nominatev2.gs` must be extended to route `markSent`:

```javascript
// In nominatev2.gs — extend existing doPost to route markSent
if (payload.action === 'markSent') {
  return _handleMarkSent(payload);
}
```

### Pattern 2: getAllNominees — Batch Read (HIGH confidence)

Read all rows in a single `getValues()` call, map to a JSON array, return via `_jsonResponse`. Mirrors the `_loadEmailIndex` batch-read approach from `nominatev2.gs`.

```javascript
// Source: established pattern from _loadEmailIndex in nominatev2.gs
function _handleGetAllNominees() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return _jsonResponse({ ok: true, nominees: [] });
  }

  // Read all data rows in one API call — columns A through W (23 cols)
  var dataRowCount = lastRow - 1;
  var rows = sheet.getRange(2, 1, dataRowCount, 23).getValues();

  var nominees = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    nominees.push({
      firstName:   String(r[5]  || ''), // F col 6 (0-based 5)
      lastName:    String(r[6]  || ''), // G col 7 (0-based 6)
      refEmail:    String(r[7]  || ''), // H col 8 (0-based 7)
      draName:     String(r[1]  || ''), // B col 2 (0-based 1)
      status:      String(r[18] || ''), // S col 19 (0-based 18)
      token:       String(r[17] || ''), // R col 18 (0-based 17)
      refWeekend1: String(r[21] || ''), // V col 22 (0-based 21)
      refWeekend2: String(r[22] || '')  // W col 23 (0-based 22)
    });
  }

  return _jsonResponse({ ok: true, nominees: nominees });
}
```

**Column index note:** The range reads 23 columns (A=1 through W=23). 0-based indices in the result array: F=5, G=6, H=7, B=1, S=18, R=17, V=21, W=22. Double-check against COLUMN-MAP.md before implementation.

### Pattern 3: markSent — Token Lookup + Two-Cell Write (HIGH confidence)

Reuses `_findRowByToken` from `refdetails.gs` (already in shared scope). Writes Status='Sent' (col 19) and SentAt=new Date() (col 20) to the referee's row. Uses LockService.

```javascript
// Source: pattern from _handleSubmitDetails in refdetails.gs
function _handleMarkSent(payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    var token = (payload.token || '').trim();

    if (!token) {
      return _jsonResponse({ ok: false, error: 'missing_token', message: 'No token provided.' });
    }

    var rowNum = _findRowByToken(sheet, token);

    if (rowNum === -1) {
      return _jsonResponse({ ok: false, error: 'invalid_token', message: 'Token not found.' });
    }

    // Only update if status is still 'Not Sent' — idempotent, safe to re-click
    var currentStatus = sheet.getRange(rowNum, COL_STATUS).getValue();
    if (currentStatus !== 'Not Sent') {
      return _jsonResponse({ ok: true, alreadyMarked: true });
    }

    sheet.getRange(rowNum, COL_STATUS).setValue('Sent');   // S = col 19
    sheet.getRange(rowNum, COL_SENT_AT).setValue(new Date()); // T = col 20

    Logger.log('_handleMarkSent: Row ' + rowNum + ' marked Sent.');
    return _jsonResponse({ ok: true, alreadyMarked: false });

  } finally {
    lock.releaseLock();
  }
}
```

**COL_SENT_AT = 20** — this constant is defined in COLUMN-MAP.md but not yet declared in any `.gs` file. It must be declared in `adminemail.gs`.

### Pattern 4: CORS-Safe Fetch (HIGH confidence — proven in Phases 2 and 3)

The proven pattern from `referee-details.html` and `spring-state-cup-nomination.html`:

**For GET requests (getAllNominees):**
```javascript
// Simple GET — no preflight, works cross-origin from GitHub Pages
// Source: referee-details.html line 579 comment: "No options — simple fetch works for 'anyone anonymous' GAS deployment"
var res = await fetch(SCRIPT_URL + '?action=getAllNominees');
if (!res.ok) throw new Error('HTTP ' + res.status);
var data = await res.json();
```

**For POST requests (markSent):**
```javascript
// No Content-Type header — avoids CORS preflight (same as Phase 2 nominateV2 pattern)
// Source: referee-details.html line 738 comment
var res = await fetch(SCRIPT_URL, {
  method: 'POST',
  body: JSON.stringify({ action: 'markSent', token: token })
});
var data = await res.json();
```

**Why this works:** Apps Script deployed as "Anyone" processes the request and returns `ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON)`. The browser receives a CORS-safe response because GAS serves JSON responses with permissive CORS headers for anonymous access. The key is NOT setting `Content-Type: application/json` on the POST — that would trigger a preflight OPTIONS request that GAS cannot handle.

### Pattern 5: Mailto URL Construction

Build the mailto link in JavaScript at table-render time. Use `encodeURIComponent` on subject and body separately.

```javascript
// Source: established browser pattern, verified against Outlook behavior research
function buildMailtoHref(nominee, props) {
  var subject = 'State Cup Referee Nomination \u2014 Action Required';
  var body = [
    'Dear ' + nominee.firstName + ',',
    '',
    'You have been nominated to officiate at the Tennessee State Cup tournament by ' + nominee.draName + '.',
    '',
    'Tournament Dates:',
    '  Weekend 1: ' + props.weekend1Dates,
    '  Weekend 2: ' + props.weekend2Dates,
    '',
    'Please complete your referee details form using the link below:',
    props.refFormUrl + '?token=' + nominee.token,
    '',
    'Please respond by [DEADLINE DATE].',
    '',
    'If you have questions, please contact:',
    props.assignorEmail,
    '',
    'Thank you,',
    'Tennessee Soccer State Cup Assignor'
  ].join('\n');

  return 'mailto:' + encodeURIComponent(nominee.refEmail)
    + '?subject=' + encodeURIComponent(subject)
    + '&body=' + encodeURIComponent(body);
}
```

**Character budget:** The body above is approximately 600-700 characters before encoding. After `encodeURIComponent`, most characters become 3 bytes (`%XX`), so worst case ~2100 encoded bytes in the body segment alone. The 1800-character guideline from CONTEXT.md refers to the raw (pre-encoded) body. Keep raw body under 1600 characters to ensure the full mailto URL stays under ~5000 characters, which is well within modern Outlook's 8192-character URL limit.

### Pattern 6: Mailto Click + markSent API Call Flow

Use an `onclick` handler on a button or `<a>` tag. The API call fires first (fire-and-forget is acceptable), then `window.location.href` opens the mail client:

```javascript
// onclick handler — fires API call then opens Outlook
async function handleEmailClick(btn, nominee) {
  var href = btn.dataset.mailtoHref; // pre-computed at render time

  // Mark sent via API (fire and forget — user shouldn't wait for Outlook)
  try {
    var res = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'markSent', token: nominee.token })
    });
    var data = await res.json();
    if (data.ok) {
      // Update row in-place
      updateRowStatus(nominee.token, 'Sent');
    }
  } catch (err) {
    // Non-fatal — Outlook still opens, assignor can re-mark manually
    console.warn('markSent failed:', err);
  }

  // Open Outlook
  window.location.href = href;
}
```

**Why `await` before `window.location.href`:** The fetch is fast (under 1 second on a good connection). Awaiting it before opening Outlook means the sheet is marked before the email client pops. If the fetch fails, Outlook still opens — the mailto link is never blocked.

### Anti-Patterns to Avoid

- **Re-declaring doGet or doPost in adminemail.gs:** GAS has one project-level scope. A second `function doGet` in a new `.gs` file will cause a conflict. Extend the existing entry points in `refdetails.gs` and `nominatev2.gs`.
- **Setting Content-Type: application/json on the markSent POST:** Triggers preflight OPTIONS which GAS cannot handle. Omit Content-Type entirely (body is still JSON-stringified).
- **Using `no-cors` mode on fetch:** Returns an opaque response — you can't read `data.ok` or update the row in-place.
- **Building the mailto href inside the onclick handler every time:** Pre-compute `href` at render time and store in `data-mailto-href` attribute. Onclick reads the attribute — faster and testable.
- **Reading each nominee's row individually in getAllNominees:** Never call `getValue()` in a loop. One `getValues()` for the entire data range.

## Don't Hand-Roll

Problems that look simple but have existing solutions within the project:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token-based row lookup | New scan loop | `_findRowByToken(sheet, token)` from `refdetails.gs` | Already in shared GAS scope; handles all edge cases |
| JSON API response | Custom response builder | `_jsonResponse(obj)` from `nominatev2.gs` | Already in shared scope |
| Table sort | Custom DOM manipulation | 10-20 line vanilla JS comparator on `Array.sort` | Simple enough to hand-write; no library needed for <100 rows |
| Spreadsheet column map | Guessing column numbers | `COLUMN-MAP.md` constants | Authoritative; deviating introduces bugs |
| Script property reads | Re-implementing | `PropertiesService.getScriptProperties()` | Established in Phase 3 |

**Key insight:** This project deliberately has no external library dependencies for the backend. All primitives are in the existing `.gs` files and are available project-wide. Phase 4 builds on them, not around them.

## Common Pitfalls

### Pitfall 1: New Outlook — Form Link Not Clickable in mailto Body

**What goes wrong:** The referee's form URL (e.g., `https://username.github.io/...?token=...`) is placed in the mailto body text. In Classic Outlook for Windows, it renders as a clickable hyperlink. In New Outlook (the default for new Microsoft 365 deployments in 2025-2026), URLs in mailto-populated bodies may not auto-hyperlink — the assignor sees the URL as plain text and must copy-paste it.
**Why it happens:** New Outlook is a different rendering engine (essentially an Outlook web app client) with different auto-link detection behavior in pre-filled email bodies.
**How to avoid:** This is a platform bug, not something we can fix with encoding changes. The email body should put the URL on its own line with a short prompt: "Please use the link below:" followed by the raw URL on a new line. This maximizes readability and copy-paste usability. No workaround makes it reliably clickable in New Outlook.
**Warning signs:** Assignor reports the link in the Outlook draft isn't clickable. Resolution: they can right-click > copy the URL, or forward to themselves in web Outlook.

### Pitfall 2: Apps Script Deployment — New Deployment Required for Code Changes

**What goes wrong:** After adding `adminemail.gs` or modifying `doGet`/`doPost` routing, the assignor's admin page still hits the old deployment URL and gets the old behavior.
**Why it happens:** Apps Script requires creating a new deployment (not re-deploying to the same version) for any code change to take effect.
**How to avoid:** After adding `adminemail.gs` and modifying entry-point routing in `refdetails.gs`/`nominatev2.gs`, create a **new** deployment. The new `/exec` URL must be hardcoded in `admin.html` as `SCRIPT_URL`. The old deployment URL (Phase 3) in `referee-details.html` does NOT need to change — it still works because the form's submit flow hasn't changed.
**Warning signs:** `getAllNominees` returns `{ ok: false, error: 'missing_token' }` — this means the old `doGet` (token-only, no action routing) is still live.

### Pitfall 3: Simultaneous markSent Calls (Low Risk Here, Documented for Awareness)

**What goes wrong:** If the assignor somehow clicks two mailto links in rapid succession (unlikely), two concurrent markSent POSTs could arrive at the same time.
**Why it happens:** LockService protects against concurrent writes, but if row A and row B are both being marked simultaneously, no race condition exists — they write different rows.
**How to avoid:** LockService is still the right approach. The idempotency check (`if (currentStatus !== 'Not Sent') return { ok: true, alreadyMarked: true }`) prevents double-writes on the same row.

### Pitfall 4: Column Index Off-by-One in getAllNominees

**What goes wrong:** `getRange(2, 1, dataRowCount, 23)` returns a 2D array; indexing `r[21]` for column V (1-based: 22) only works if the range starts at column 1. If someone later changes the range start column, all indices shift.
**Why it happens:** 0-based array index = (1-based column number) - 1, which only works when the range starts at column 1 (A).
**How to avoid:** Always read from column 1 (A) in getAllNominees. Cross-reference every 0-based index against COLUMN-MAP.md's 0-based column. Document the derivation in a comment: `r[18] // S = col 19 (0-based 18)`.

### Pitfall 5: REF_FORM_URL is Still 'TBD'

**What goes wrong:** The Script Property `REF_FORM_URL` was set to `'TBD — set to GitHub Pages URL before Phase 4'` in Phase 2. If `getAllNominees` reads this property and returns it in the payload, the admin page will build mailto links with a placeholder URL in the body.
**Why it happens:** Phase 2 recorded this as a known blocker; it must be set before Phase 4 execution.
**How to avoid:** Phase 4 planning must include a step: before deploying the admin page, run `setTournamentConstants` (or a new setter) to update `REF_FORM_URL` to the actual GitHub Pages URL. Alternatively, the admin page HTML can hardcode `REF_FORM_URL` as a constant that's set at deploy time — but using Script Properties keeps it in one place.

### Pitfall 6: mailto URL Exceeds Usable Length

**What goes wrong:** If tournament details, the referee name, dates, and a long token URL push the raw body over ~1600 characters, the pre-encoded body becomes very long (each special char = 3 bytes after encoding). Outlook for Microsoft 365 supports up to 8192 characters for general URLs; however, some edge cases or corporate proxy tools may truncate earlier.
**Why it happens:** The body contains a token (UUID = 36 chars) embedded in a full HTTPS URL.
**How to avoid:** Keep the raw body under 1600 characters. The body template in the Code Examples section is approximately 600-700 characters. Avoid repeating tournament information. Test with a realistic token.

## Code Examples

### getAllNominees Fetch (Admin Page JavaScript)

```javascript
// Source: referee-details.html loadRefereeData() pattern — proven cross-origin fetch
const SCRIPT_URL = 'PASTE_NEW_DEPLOYMENT_URL_HERE';

async function loadNominees() {
  var res = await fetch(SCRIPT_URL + '?action=getAllNominees');
  if (!res.ok) throw new Error('HTTP ' + res.status);
  var data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Failed to load nominees');
  return data.nominees; // Array of nominee objects
}
```

### Vanilla JS Table Sort (No Library)

```javascript
// Sort direction state per column
var sortState = { col: 'status', dir: 'asc' };

function sortNominees(nominees, col, dir) {
  var statusOrder = { 'Not Sent': 0, 'Sent': 1, 'Confirmed': 2 };
  return nominees.slice().sort(function(a, b) {
    var av = col === 'status' ? (statusOrder[a.status] || 99) : (a[col] || '').toLowerCase();
    var bv = col === 'status' ? (statusOrder[b.status] || 99) : (b[col] || '').toLowerCase();
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}

// Default sort: Not Sent first
nominees = sortNominees(nominees, 'status', 'asc');
```

### Search Box Filter (Vanilla JS)

```javascript
// Filter by name or email as you type
document.getElementById('search').addEventListener('input', function() {
  var q = this.value.toLowerCase();
  var rows = document.querySelectorAll('#nominee-tbody tr');
  rows.forEach(function(row) {
    var text = row.textContent.toLowerCase();
    row.style.display = text.includes(q) ? '' : 'none';
  });
});
```

### Status Badge CSS (Following Project Design System)

```css
/* Source: matches project color palette from spring-state-cup-nomination.html */
.badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 3px 9px;
  border-radius: 3px;
}
.badge-not-sent {
  background: #e8eaed;
  color: #3c4043;  /* per COLUMN-MAP.md status color definitions */
}
.badge-sent {
  background: #fef9c3;
  color: #854d0e;
}
.badge-confirmed {
  background: #dcfce7;
  color: #166534;
}
```

### Summary Counts Bar (Recommended — Claude's Discretion)

```javascript
// Count by status, render above table
function renderSummary(nominees) {
  var counts = { 'Not Sent': 0, 'Sent': 0, 'Confirmed': 0 };
  nominees.forEach(function(n) { if (counts[n.status] !== undefined) counts[n.status]++; });
  document.getElementById('summary').innerHTML =
    '<span class="badge badge-not-sent">' + counts['Not Sent'] + ' Not Sent</span> ' +
    '<span class="badge badge-sent">' + counts['Sent'] + ' Sent</span> ' +
    '<span class="badge badge-confirmed">' + counts['Confirmed'] + ' Confirmed</span>';
}
```

### In-Place Row Status Update (Recommended — Claude's Discretion)

After `markSent` succeeds, update the row's badge and button without a page reload:

```javascript
function updateRowStatus(token, newStatus) {
  var row = document.querySelector('[data-token="' + token + '"]');
  if (!row) return;
  var badge = row.querySelector('.badge');
  badge.className = 'badge badge-' + newStatus.toLowerCase().replace(' ', '-');
  badge.textContent = newStatus;
  // Disable the email button to signal it's already sent
  var btn = row.querySelector('.email-btn');
  if (btn) btn.disabled = true;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| v1.0 MailApp server-send | v2.0 mailto links to Outlook | 2026-03-19 (v2.0 pivot) | Assignor controls sending from their own Outlook account |
| v1.0 status: Confirmed/Declined | v2.0 status: Not Sent/Sent/Confirmed | 2026-03-19 | Status values locked — never use old values |
| v1.0 DRA provides all details | v2.0 referee provides own details | 2026-03-19 | Token in email body links to referee-details.html |

**Deprecated / outdated:**
- `status = 'Pending'`: Not valid in v2.0. Dropdown validation rejects it.
- `status = 'Declined'`: Not valid in v2.0.
- `MailApp.sendEmail()`: Never use — assignor is on Microsoft 365 and wants to send from their own Outlook account.
- v1.0 deployment URLs: Both Phase 2 and Phase 3 have new deployment URLs. Phase 4 must create another new deployment.

## Open Questions

1. **REF_FORM_URL must be set before admin page goes live**
   - What we know: Script Property `REF_FORM_URL` is currently `'TBD — set to GitHub Pages URL before Phase 4'`
   - What's unclear: The exact GitHub Pages URL for `referee-details.html` — it depends on the repo name and GitHub username
   - Recommendation: Phase 4 plan must include a step to run `setTournamentConstants` (updating only `REF_FORM_URL`) before testing the email body. The URL pattern is `https://<username>.github.io/<repo-name>/referee-details.html`

2. **Admin page access control**
   - What we know: The page is a static HTML file on GitHub Pages — anyone with the URL can open it
   - What's unclear: Whether the assignor wants any access restriction (password, link obscurity)
   - Recommendation: The CONTEXT.md does not list any auth requirement. The admin page URL is effectively a secret URL — not linked from anywhere public. This is acceptable for this use case. Document this as a known limitation.

3. **SentAt (column T) overwrite behavior**
   - What we know: `markSent` writes `new Date()` to column T when status is `Not Sent`; the idempotency check returns early if status is already `Sent` or `Confirmed`
   - What's unclear: What if the assignor accidentally marks Sent for a referee who already has `Confirmed` status?
   - Recommendation: The idempotency check `if (currentStatus !== 'Not Sent') return { alreadyMarked: true }` prevents any overwrite of `Confirmed` rows. This is safe.

## Sources

### Primary (HIGH confidence)
- `scripts/refdetails.gs` (this project) — doGet pattern, _findRowByToken, _handleSubmitDetails, _getDeadlineState, CORS-safe pattern comments
- `scripts/nominatev2.gs` (this project) — doPost routing, _appendNewRow, LockService, _jsonResponse, setTournamentConstants
- `referee-details.html` (this project) — proven cross-origin fetch patterns (both GET and POST), CORS comments at lines 579 and 738
- `spring-state-cup-nomination.html` (this project) — proven POST pattern, same CORS approach
- `.planning/COLUMN-MAP.md` (this project) — authoritative column indices for all fields Phase 4 needs

### Secondary (MEDIUM confidence)
- [Google Apps Script Web Apps docs](https://developers.google.com/apps-script/guides/web) — doGet/doPost parameter handling confirmed
- [Microsoft Q&A: New Outlook mailto truncation](https://learn.microsoft.com/en-us/answers/questions/1063670/outlook-for-microsoft-365-truncating-long-urls) — URL limit increased to 8192 chars in M365
- [Microsoft's New Outlook Rollout Timeline](https://www.itbear.com/technews/microsofts-new-outlook-rollout-2025-launch-2026-completion/) — New Outlook is default for new M365 deployments in 2025

### Tertiary (LOW confidence — flag for validation)
- [New Outlook mailto body link clickability bug](https://learn.microsoft.com/en-us/answers/questions/1406485/issue-with-url-not-clickable-in-new-outlook-mailto) — confirmed bug report; no fix confirmed as of research date; workaround is plain text URL on its own line

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every tool is already in use in this project
- Architecture (GAS extension pattern): HIGH — based on actual project code, not hypothetical
- CORS fetch pattern: HIGH — directly quoted from Phase 3 HTML with inline explanatory comments
- markSent implementation: HIGH — directly parallels _handleSubmitDetails from refdetails.gs
- mailto character limits: MEDIUM — Microsoft docs confirm 8192 char limit for M365 general URLs; mailto body specifically may differ
- New Outlook link clickability pitfall: MEDIUM — confirmed bug in official Microsoft Q&A thread; behavior may have changed since thread (March 2023)
- Table sort / filter pattern: HIGH — simple well-known vanilla JS

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (30 days; stable domain — Apps Script API and Outlook mailto behavior do not change frequently)
