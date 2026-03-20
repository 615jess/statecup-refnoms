# Phase 3: Referee Detail Form + Backend - Research

**Researched:** 2026-03-20
**Domain:** Google Apps Script doGet/doPost + static HTML form (token-secured, multi-state)
**Confidence:** HIGH — built on verified Phase 2 patterns, codebase artifacts, and confirmed GAS documentation

---

## Summary

Phase 3 extends the existing Apps Script project (currently doPost-only) with two new capabilities:
(1) a `doGet` endpoint that accepts a token query parameter and returns referee and tournament data
as JSON, and (2) a new `doPost` action (`submitDetails`) that updates the referee's existing row
with their form responses. A new static HTML file (`referee-details.html`) hosted on GitHub Pages
drives the UX with six distinct states: loading, form, late-notice banner, hard-closed, error,
and success.

The most important technical fact for this phase: **a simple `fetch(url)` GET with no special
options works correctly against a GAS endpoint deployed with "Execute as: Me, Access: Anyone
(even anonymous)"** — the same deployment configuration already used for Phase 2. The response
body is readable and can be parsed as JSON. No `mode: no-cors`, no Content-Type tricks, no JSONP
required. This is the same deployment configuration that already exists; Phase 3 just adds
`doGet` to the same script file and creates a new deployment.

The deadline/grace-period logic is the most complex piece of backend state. The ConfirmationDeadline
named range in Z1 returns a JavaScript Date object via `getValue()`. Compare it to `new Date()`
using date arithmetic (adding 3 days in milliseconds) to determine open / late / hard-closed state.

**Primary recommendation:** Add `doGet` and `_handleGetDetails` functions to a new .gs file
(`refdetails.gs`) in the same Apps Script project. Use the same `_jsonResponse` helper from
`nominatev2.gs`. Build `referee-details.html` as a new file styled to match the DRA form's
exact CSS variables and component patterns.

---

## Standard Stack

### Core

| Component | Version / Source | Purpose | Notes |
|-----------|------------------|---------|-------|
| Google Apps Script | V8 runtime (current) | doGet token lookup, doPost submitDetails, deadline state | Same project as nominatev2.gs |
| SpreadsheetApp | Built-in GAS service | Token scan (col R), row read (cols A-Y), row update | getDataRange, getRange, setValues |
| LockService | Built-in GAS service | Serialize concurrent writes in submitDetails | `LockService.getScriptLock()` — same pattern as nominateV2 |
| PropertiesService | Built-in GAS service | Read ASSIGNOR_EMAIL, WEEKEND_1_DATES, WEEKEND_2_DATES (already set in Phase 2) | `PropertiesService.getScriptProperties()` |
| Fetch API | Browser-native | GET to doGet endpoint (on page load), POST to doPost submitDetails | No library needed — browser-native |
| Open Sans | Google Fonts CDN (already loaded in DRA form) | Typography — same link tag pattern | Keep identical `<link>` tag |

### Supporting

| Component | Purpose | Notes |
|-----------|---------|-------|
| HTML5 URLSearchParams | Parse `?token=...` from window.location | `new URLSearchParams(window.location.search).get('token')` — browser-native, no library |
| CSS custom properties (already in DRA form) | Consistent navy/red/gold styling | Copy `--navy`, `--red`, `--gold`, etc. from existing form exactly |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Simple `fetch(url)` GET | JSONP with `<script>` tag | JSONP is obsolete; simple fetch works with "anyone anonymous" deployment |
| Simple `fetch(url)` GET | `fetch` with `mode: no-cors` | no-cors gives opaque response — body is unreadable; defeats the purpose |
| New .gs file (refdetails.gs) | Adding to nominatev2.gs | Separation keeps Phase 2 code clean; same compiled Apps Script project |

**Installation:** No npm. No new CDN scripts. Everything uses browser-native APIs and existing patterns.

---

## Architecture Patterns

### Recommended File Structure

```
/
├── spring-state-cup-nomination.html    # Phase 2 (done)
├── referee-details.html                # Phase 3 (new)
└── scripts/
    ├── setup-schema-v2.gs              # Phase 1 (done)
    ├── verify-schema-v2.gs             # Phase 1 (done)
    ├── nominatev2.gs                   # Phase 2 (done)
    └── refdetails.gs                   # Phase 3 (new — paste into Apps Script editor)
```

`refdetails.gs` goes into the same Apps Script project as `nominatev2.gs`. Both files are pasted
into the Apps Script editor; the project contains all four .gs files. A new deployment is created
after pasting.

### Pattern 1: doGet Token Lookup

**What:** doGet reads `e.parameter.token`, scans column R for a match, reads the full row, reads
the ConfirmationDeadline named range, assembles a JSON response.

**When to use:** Always on page load — the HTML page calls this before showing anything.

```javascript
// refdetails.gs

function doGet(e) {
  try {
    var token = (e.parameter && e.parameter.token) || '';

    if (!token) {
      return _jsonResponse({ ok: false, error: 'missing_token', message: 'No token provided.' });
    }

    return _handleGetDetails(token);

  } catch (err) {
    Logger.log('doGet error: ' + err.message);
    return _jsonResponse({ ok: false, error: 'server_error', message: err.message });
  }
}

function _handleGetDetails(token) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();

  // --- Token lookup: scan column R (COL_TOKEN = 18) for match ---
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return _jsonResponse({ ok: false, error: 'invalid_token', message: 'Token not found.' });
  }

  var tokens = sheet.getRange(2, COL_TOKEN, lastRow - 1, 1).getValues();
  var rowNum = -1;

  for (var i = 0; i < tokens.length; i++) {
    if (String(tokens[i][0]).trim() === token) {
      rowNum = i + 2; // +2: 1-based, skip header
      break;
    }
  }

  if (rowNum === -1) {
    return _jsonResponse({ ok: false, error: 'invalid_token', message: 'Token not found.' });
  }

  // --- Read referee row (columns A through Y = 25 columns) ---
  var rowData = sheet.getRange(rowNum, 1, 1, 25).getValues()[0];

  // --- Read ConfirmationDeadline named range ---
  var deadlineRange = ss.getRangeByName('ConfirmationDeadline');
  var deadlineState = 'open';
  var deadlineDisplay = '';

  if (deadlineRange) {
    var deadlineVal = deadlineRange.getValue();
    if (deadlineVal instanceof Date && !isNaN(deadlineVal.getTime())) {
      var now = new Date();
      var hardClose = new Date(deadlineVal.getTime() + 3 * 24 * 60 * 60 * 1000); // +3 days

      if (now > hardClose) {
        deadlineState = 'hard_closed';
      } else if (now > deadlineVal) {
        deadlineState = 'late';
      } else {
        deadlineState = 'open';
      }

      deadlineDisplay = Utilities.formatDate(deadlineVal, Session.getScriptTimeZone(), 'MMMM d, yyyy');
    }
  }

  // --- Read tournament constants ---
  var props = PropertiesService.getScriptProperties();

  return _jsonResponse({
    ok: true,
    deadlineState: deadlineState,        // 'open' | 'late' | 'hard_closed'
    deadlineDisplay: deadlineDisplay,    // e.g., "April 30, 2026"

    // Referee identity
    firstName:    String(rowData[5]  || ''), // F (index 5)
    lastName:     String(rowData[6]  || ''), // G
    refEmail:     String(rowData[7]  || ''), // H

    // DRA context
    draName:      String(rowData[1]  || ''), // B
    draEmail:     String(rowData[2]  || ''), // C

    // Status and prior submission
    status:       String(rowData[18] || ''), // S (index 18)
    submittedAt:  rowData[20] ? String(rowData[20]) : '', // U (index 20)

    // Referee-provided fields (may be blank on first visit)
    phone:        String(rowData[8]  || ''), // I
    age:          String(rowData[9]  || ''), // J
    availability: String(rowData[12] || ''), // M
    gender:       String(rowData[13] || ''), // N
    hotelWkd1:    String(rowData[14] || ''), // O
    hotelWkd2:    String(rowData[15] || ''), // P
    refWeekend1:  String(rowData[21] || ''), // V (index 21)
    refWeekend2:  String(rowData[22] || ''), // W
    lateFlag:     String(rowData[23] || ''), // X
    refNotes:     String(rowData[24] || ''), // Y

    // Tournament context (from PropertiesService)
    weekend1Dates: props.getProperty('WEEKEND_1_DATES') || '',
    weekend2Dates: props.getProperty('WEEKEND_2_DATES') || '',
    assignorEmail: props.getProperty('ASSIGNOR_EMAIL')  || ''
  });
}
```

### Pattern 2: doPost submitDetails Action

**What:** doPost routes `action=submitDetails` to `_handleSubmitDetails`. Acquires LockService,
finds the row by token (same scan as doGet), enforces deadline state, writes referee columns,
updates Status to "Confirmed", writes SubmittedAt and optionally LateFlag.

**When to use:** Always on form submit.

**Late flag logic:**
- If `deadlineState === 'hard_closed'` → reject with JSON error
- If `deadlineState === 'late'` AND row has no prior submission (SubmittedAt is blank) → write
  LateFlag = 'Y'
- If `deadlineState === 'late'` AND row already has a SubmittedAt value → this is an edit during
  grace period; do NOT write LateFlag = 'Y' (CONTEXT.md decision)
- If `deadlineState === 'open'` → no late flag regardless

```javascript
// In existing doPost (nominatev2.gs) OR in refdetails.gs — add this case:
// if (payload.action === 'submitDetails') return _handleSubmitDetails(payload);

function _handleSubmitDetails(payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();

    // Deadline check (same logic as doGet)
    var deadlineRange = ss.getRangeByName('ConfirmationDeadline');
    var deadlineState = 'open';
    if (deadlineRange) {
      var deadlineVal = deadlineRange.getValue();
      if (deadlineVal instanceof Date && !isNaN(deadlineVal.getTime())) {
        var now = new Date();
        var hardClose = new Date(deadlineVal.getTime() + 3 * 24 * 60 * 60 * 1000);
        if (now > hardClose) deadlineState = 'hard_closed';
        else if (now > deadlineVal) deadlineState = 'late';
      }
    }

    if (deadlineState === 'hard_closed') {
      return _jsonResponse({ ok: false, error: 'hard_closed', message: 'Submissions are closed.' });
    }

    // Token lookup
    var token = payload.token || '';
    var lastRow = sheet.getLastRow();
    var tokens = sheet.getRange(2, COL_TOKEN, lastRow - 1, 1).getValues();
    var rowNum = -1;
    for (var i = 0; i < tokens.length; i++) {
      if (String(tokens[i][0]).trim() === token) { rowNum = i + 2; break; }
    }
    if (rowNum === -1) {
      return _jsonResponse({ ok: false, error: 'invalid_token', message: 'Token not found.' });
    }

    // Read existing SubmittedAt to determine late flag behavior
    var existingSubmittedAt = sheet.getRange(rowNum, COL_SUBMITTED_AT).getValue();
    var isFirstSubmission = !existingSubmittedAt;

    // Write referee-provided fields
    // Columns I, J (Phone, Age) — 1-based 9 and 10
    sheet.getRange(rowNum, COL_PHONE).setValue(payload.phone || '');
    sheet.getRange(rowNum, COL_AGE).setValue(payload.age || '');

    // Columns M-P in one range (Availability, Gender, Hotel Wkd1, Hotel Wkd2) — 1-based 13-16
    sheet.getRange(rowNum, COL_AVAILABILITY, 1, 4).setValues([[
      payload.availability || '',  // M
      payload.gender       || '',  // N
      payload.hotelWkd1    || '',  // O
      payload.hotelWkd2    || ''   // P
    ]]);

    // Columns V-Y in one range (RefWeekend1, RefWeekend2, LateFlag, RefNotes) — 1-based 22-25
    // Note: LateFlag (X = col 24) is written here, not from the payload
    var lateFlag = (deadlineState === 'late' && isFirstSubmission) ? 'Y' : '';
    sheet.getRange(rowNum, COL_REF_WEEKEND1, 1, 4).setValues([[
      payload.refWeekend1 || '',  // V
      payload.refWeekend2 || '',  // W
      lateFlag,                   // X (LateFlag — system-written, not user-provided)
      payload.refNotes    || ''   // Y
    ]]);

    // Write system columns
    sheet.getRange(rowNum, COL_STATUS).setValue('Confirmed');          // S
    sheet.getRange(rowNum, COL_SUBMITTED_AT).setValue(new Date());     // U

    return _jsonResponse({ ok: true, lateFlag: lateFlag || null });

  } finally {
    lock.releaseLock();
  }
}
```

### Pattern 3: Frontend State Machine

**What:** The HTML page uses a JavaScript state machine driven by the doGet response.
On load: show loading skeleton, call doGet, then transition to the appropriate state.

**Six states and their triggers:**

| State | CSS Class / ID | Trigger Condition |
|-------|---------------|-------------------|
| `loading` | `#state-loading` | Always shown first while fetch is in progress |
| `form` | `#state-form` | `ok: true`, `deadlineState: 'open'` or `'late'` |
| `late-banner` | `.late-banner` inside `#state-form` | `deadlineState: 'late'` — banner visible within form state |
| `hard_closed` | `#state-closed` | `ok: true`, `deadlineState: 'hard_closed'` |
| `error` | `#state-error` | `ok: false` (any error code) |
| `success` | `#state-success` | After successful POST response |

**State transition flow:**

```
page load
  → show #state-loading
  → fetch GET ?token=...
    ├─ network error          → show #state-error (generic message + assignor contact)
    ├─ ok: false              → show #state-error (token invalid or server error)
    ├─ deadlineState=hard_closed → show #state-closed (friendly message + assignor contact)
    └─ deadlineState=open|late
         → populate form fields from response
         → if late: show .late-banner, hide it otherwise
         → set submit button text: "Update Details" if submittedAt exists, else "Submit Details"
         → show #state-form

form submit
  → disable submit button (DETAIL-09)
  → POST action=submitDetails
    ├─ network error / ok: false → show inline error, re-enable button
    └─ ok: true                  → show #state-success (inline summary)
```

### Pattern 4: Frontend Fetch GET Call

**What:** Simple `fetch(url)` with no options needed. The deployment is "Execute as: Me, Anyone
(even anonymous)" — same as Phase 2. No CORS workarounds required.

```javascript
// Source: tanaikech gist (verified) — simple fetch works for publicly-deployed GAS
const SCRIPT_URL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";

async function loadRefereeData(token) {
  const url = `${SCRIPT_URL}?token=${encodeURIComponent(token)}`;
  const res = await fetch(url);  // No options needed — "anyone anonymous" deployment
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}
```

**Important:** Do NOT add `mode: 'no-cors'` — that returns an opaque response and the body
cannot be read.

### Pattern 5: Frontend POST submitDetails Call

**What:** Same as Phase 2 POST pattern — raw JSON body, no Content-Type header. This is the
same CORS workaround already proven in Phase 2.

```javascript
// Source: Phase 2 codebase — verified working pattern
async function submitDetails(token, formData) {
  const payload = {
    action: 'submitDetails',
    token: token,
    phone: formData.phone,
    age: formData.age,
    refWeekend1: formData.refWeekend1,   // e.g., 'Yes' or 'No'
    refWeekend2: formData.refWeekend2,
    hotelWkd1: formData.hotelWkd1,       // 'Yes', 'No', or '' (hidden if weekend = No)
    hotelWkd2: formData.hotelWkd2,
    gender: formData.gender,
    availability: formData.availability, // summary string or '' — Claude's discretion (col M)
    refNotes: formData.refNotes
  };

  // No Content-Type header — avoids CORS preflight (same as nominateV2 pattern)
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}
```

### Pattern 6: Hotel Field Conditional Visibility

**What:** Hotel question is shown or hidden based on the corresponding weekend availability
toggle. JavaScript listens for changes to the availability toggles and toggles `display` on
the hotel question container.

```javascript
// Driven by yes/no toggle — hotel section visibility
function updateHotelVisibility() {
  const wkd1Yes = document.querySelector('[name="refWeekend1"]').value === 'Yes';
  const wkd2Yes = document.querySelector('[name="refWeekend2"]').value === 'Yes';
  document.getElementById('hotel-wkd1-section').style.display = wkd1Yes ? '' : 'none';
  document.getElementById('hotel-wkd2-section').style.display = wkd2Yes ? '' : 'none';
}
```

**Pre-fill behavior:** When loading prior submission data, set availability toggles first, then
call `updateHotelVisibility()` to correctly show/hide hotel fields before populating them.

### Pattern 7: doGet + doPost Coexistence

**What:** A single Apps Script project can have exactly one `doGet` and one `doPost` function
across all .gs files in the project. GAS routes HTTP GET to `doGet` and HTTP POST to `doPost`
automatically.

**Implementation:** The existing `nominatev2.gs` defines `doPost`. The new `refdetails.gs` will
define `doGet`. The `doPost` in `nominatev2.gs` needs a new `action` branch for `submitDetails`.

Two options:
1. Add `submitDetails` case to `doPost` in `nominatev2.gs` (minimal file count)
2. Have `refdetails.gs` re-export `doPost` that also handles `nominateV2` (confusing)

**Use option 1:** Add `if (payload.action === 'submitDetails') return _handleSubmitDetails(payload);`
to the existing `doPost` switch in `nominatev2.gs`. Define `_handleSubmitDetails` in `refdetails.gs`.
GAS compiles all .gs files in the project together — shared helper functions are accessible.

### Pattern 8: CSS Visual Match with DRA Form

**What:** `referee-details.html` must use identical CSS variables, typography, and component
patterns as `spring-state-cup-nomination.html`. Copy the `<style>` block's `:root` section
and all shared classes verbatim.

**Exact CSS variables to carry forward:**

```css
:root {
  --navy:    #0d2148;
  --red:     #cc2229;
  --red-dk:  #a31b21;
  --white:   #ffffff;
  --off:     #f4f6f9;
  --slate:   #e8edf5;
  --border:  #d0d9e8;
  --muted:   #5a6a88;
  --text:    #1a2540;
  --gold:    #c8912a;
  --green:   #1a6b31;
  --green-bg:#edf7f0;
  --r: 6px;
}
```

**New CSS needed for Phase 3:**

```css
/* Late banner — yellow/orange warning */
.late-banner {
  background: #fffbea;
  border: 1px solid #e8cf60;
  border-left: 4px solid var(--gold);
  border-radius: var(--r);
  padding: 14px 16px;
  margin-bottom: 22px;
  font-size: 14px;
  color: #4a3a00;
}

/* Yes/No toggle buttons — availability selection */
.toggle-group { display: flex; gap: 8px; }
.toggle-btn {
  flex: 1; padding: 10px; border: 1.5px solid var(--border); border-radius: var(--r);
  background: var(--off); font-family: 'Open Sans', sans-serif; font-size: 14px;
  cursor: pointer; transition: all .18s; font-weight: 500;
}
.toggle-btn.active-yes { background: var(--green-bg); border-color: var(--green); color: var(--green); font-weight: 600; }
.toggle-btn.active-no  { background: #fef2f2; border-color: var(--red); color: var(--red); font-weight: 600; }
```

### Anti-Patterns to Avoid

- **`mode: 'no-cors'` in fetch GET:** Returns opaque response — body unreadable. Use simple `fetch(url)`.
- **`Content-Type: application/json` in POST:** Triggers CORS preflight that GAS cannot handle. Use raw body without Content-Type header (same as Phase 2).
- **Defining two `doGet` functions across .gs files:** GAS will throw an error. Only one `doGet` allowed per project. Confirm `nominatev2.gs` has no `doGet` before pasting.
- **Hardcoding the deployment URL:** Always use a named constant at the top of the HTML file. After each new deployment, only one line needs updating.
- **Using `sheet.appendRow` in submitDetails:** DETAIL-04 and API-04 explicitly prohibit creating a new row. Always find the row by token and use `sheet.getRange(rowNum, ...).setValue(s)`.
- **Setting LateFlag on edits during grace period:** Only set `LateFlag = 'Y'` when `deadlineState === 'late'` AND `SubmittedAt` was blank (first submission). Edits to already-submitted rows during grace period must not overwrite LateFlag.
- **Failing to guard against missing ConfirmationDeadline:** If `getRangeByName('ConfirmationDeadline')` returns null, treat as `deadlineState = 'open'` rather than throwing. The form should still work if the assignor hasn't set the deadline yet.
- **Reading all 26 columns as one range when only needing a few:** Prefer scoped ranges for clarity, but a single `getRange(rowNum, 1, 1, 25).getValues()[0]` read for doGet is fine and efficient (one API call).
- **Scanning column R row-by-row with individual getValue() calls:** Load the entire column as a single array (`getRange(2, COL_TOKEN, lastRow-1, 1).getValues()`), then iterate. Never call getValue() in a loop.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID token generation | Custom random string | Already generated in nominatev2.gs — read from col R | Tokens already exist; don't re-generate |
| Concurrent write protection | Manual flags | `LockService.getScriptLock()` | GAS-native; same pattern as Phase 2 |
| Tournament config | Hardcoded strings in .gs | `PropertiesService.getScriptProperties()` | Already set in Phase 2 setTournamentConstants |
| Date formatting for display | Manual date string builder | `Utilities.formatDate(date, timezone, 'MMMM d, yyyy')` | GAS-native, handles timezone |
| URL parameter parsing | `window.location.search.split('?')` | `new URLSearchParams(window.location.search).get('token')` | Browser-native, handles encoding |
| HTML escaping in JS | Custom regex replace | Follow Phase 2 `esc()` pattern: `s.replace(/&/g,'&amp;')...` | Simple, proven in Phase 2 |

**Key insight:** Almost everything needed already exists — PropertiesService constants, LockService
pattern, `_jsonResponse` helper, CSS variable system. Phase 3 is additive, not replacement.

---

## Common Pitfalls

### Pitfall 1: GAS doGet Redirect Behavior

**What goes wrong:** First request to a fresh GAS deployment sometimes redirects to a Google login
page or an intermediate URL before reaching the script. This can cause `fetch()` to follow
redirects and receive an HTML page instead of JSON.

**Why it happens:** GAS /exec URLs for publicly-deployed scripts DO follow redirects, but the
final response from a correctly deployed "anyone, even anonymous" script is the JSON from
`ContentService`. The redirect is internal to Google's infrastructure.

**How to avoid:** Deploy with "Execute as: Me, Who has access: Anyone (even anonymous)." Simple
`fetch(url)` follows the redirect automatically and receives the JSON response. If you see HTML
in the response, the deployment permissions are wrong.

**Warning signs:** `res.json()` throws "Unexpected token < in JSON" — the response is an HTML
error page. Check deployment settings.

### Pitfall 2: Stale Deployment After Code Changes

**What goes wrong:** Code changes to .gs files do not take effect in an existing deployment.
The old code continues to run.

**Why it happens:** GAS requires a new deployment for each code change. The existing deployment
URL (`AKfycby...`) continues pointing to the snapshot at time of that deployment.

**How to avoid:** After any .gs change: Deploy > New deployment > Web app. Copy the new /exec URL
and update `SCRIPT_URL` in `referee-details.html`. Also update `REF_FORM_URL` in
`setTournamentConstants()` (for Phase 4 use).

**Warning signs:** Test changes aren't reflected in behavior even though the editor shows updated
code.

### Pitfall 3: `doGet` Conflict — Two Functions of Same Name

**What goes wrong:** If `nominatev2.gs` happens to define any `doGet` function (even a stub),
the project will have two `doGet` functions and GAS will throw a compile error.

**Why it happens:** The nominatev2.gs header comments say "doGet is intentionally omitted" — but
this must be verified before adding `doGet` in `refdetails.gs`.

**How to avoid:** Before pasting `refdetails.gs`, verify that the existing project has no `doGet`
function (confirmed: nominatev2.gs comments explicitly state doGet is omitted). Do a text search
in the Apps Script editor for "doGet" before pasting.

### Pitfall 4: LateFlag on Edits vs. First Submission

**What goes wrong:** A referee who submitted before the deadline edits their response during the
grace period and gets their status changed to LateFlag = 'Y'.

**Why it happens:** submitDetails logic sets LateFlag based only on `deadlineState === 'late'`
without checking whether the referee already submitted.

**How to avoid:** Before writing, read `COL_SUBMITTED_AT` for the row. If it already has a value,
this is an edit — do not set LateFlag. Only set LateFlag when SubmittedAt is blank (first
submission during grace period). See Pattern 2 for implementation.

### Pitfall 5: Hotel Fields Submitted When Hidden

**What goes wrong:** The hotel question for a weekend is hidden because the referee said "No" to
that weekend, but the field's old value (from a prior submission) is still in the DOM and gets
submitted in the POST payload.

**Why it happens:** Hiding a form element with `display:none` does not clear its value.

**How to avoid:** When the weekend toggle changes to "No", also clear the hotel field's value
programmatically. In the `updateHotelVisibility()` function: if hiding hotel-wkd1-section, set
the hotel-wkd1 input to `''`. Submit the cleared value — this correctly overwrites any prior
"Yes" hotel entry in the sheet.

### Pitfall 6: Date Comparison Off-by-One (Timezone)

**What goes wrong:** The ConfirmationDeadline date (e.g., April 30) is compared to `new Date()`
(current UTC time). A referee in Central time submitting at 11pm on April 30 is 1am May 1 UTC
and wrongly treated as late.

**Why it happens:** Apps Script `new Date()` uses UTC. The deadline date from the sheet may
be midnight of the deadline day in the sheet's local timezone.

**How to avoid:** For the deadline comparison, compare date portions only — not exact timestamps.
Use: `deadline.getFullYear(), deadline.getMonth(), deadline.getDate()` vs current date in
script timezone. Or simply note that the 3-day grace period provides a reasonable buffer and
an exact time-of-day cutoff is not required per the spec. Use end-of-day for the deadline:
`deadlineVal.setHours(23, 59, 59, 999)` before comparing.

### Pitfall 7: Pre-fill Order Matters for Hotel Visibility

**What goes wrong:** Form loads with prior submission data, hotel fields are populated, but then
`updateHotelVisibility()` runs and hides them — clearing the values as a side effect.

**Why it happens:** If hotel values are set before availability toggles are set, the visibility
update after setting toggles may clear the hotel values.

**How to avoid:** Always set availability toggles first, then call `updateHotelVisibility()`,
then set hotel field values. Pre-fill sequence must be: toggles → visibility → hotel values.

### Pitfall 8: Token in URL Exposes Referee to Link Sharing

**What goes wrong:** Not a bug, but a design note — the token URL is not secret from the
referee, so they can share it. Per the requirements, this is acceptable (low-sensitivity data,
per REQUIREMENTS.md "Out of Scope: Login / authentication").

**How to avoid:** No action needed. Document in code that the token provides identity, not
security. The expiry mechanism (hard-close) is the only enforcement needed.

---

## Code Examples

### doGet Token Lookup (verified GAS pattern)

```javascript
// Source: GAS docs e.parameter pattern + Phase 2 codebase patterns
// refdetails.gs

function doGet(e) {
  try {
    var token = (e.parameter && e.parameter.token) ? e.parameter.token.trim() : '';
    if (!token) {
      return _jsonResponse({ ok: false, error: 'missing_token', message: 'No token in URL.' });
    }
    return _handleGetDetails(token);
  } catch (err) {
    Logger.log('doGet error: ' + err.message);
    return _jsonResponse({ ok: false, error: 'server_error', message: 'Internal error.' });
  }
}
```

### Reading Named Range Deadline

```javascript
// Source: GAS docs Spreadsheet.getRangeByName (returns null if not found)
var ss = SpreadsheetApp.getActiveSpreadsheet();
var deadlineRange = ss.getRangeByName('ConfirmationDeadline');

if (!deadlineRange) {
  // Named range not set up — treat as open (don't throw)
  deadlineState = 'open';
} else {
  var deadlineVal = deadlineRange.getValue(); // Returns a JavaScript Date if cell has a date
  if (!(deadlineVal instanceof Date) || isNaN(deadlineVal.getTime())) {
    deadlineState = 'open'; // Cell is empty or not a date
  } else {
    deadlineVal.setHours(23, 59, 59, 999); // End of deadline day
    var hardClose = new Date(deadlineVal.getTime() + 3 * 24 * 60 * 60 * 1000);
    var now = new Date();
    if (now > hardClose) deadlineState = 'hard_closed';
    else if (now > deadlineVal) deadlineState = 'late';
    else deadlineState = 'open';
  }
}
```

### Frontend: Parse Token from URL

```javascript
// Source: MDN URLSearchParams — browser-native
const token = new URLSearchParams(window.location.search).get('token') || '';

if (!token) {
  showState('error', { message: 'No token found in URL.', assignorEmail: '' });
} else {
  loadRefereeData(token);
}
```

### Frontend: Simple GET to GAS (no special options)

```javascript
// Source: tanaikech gist — verified: simple fetch works for "anyone anonymous" GAS deployment
const SCRIPT_URL = 'https://script.google.com/macros/s/DEPLOYMENT_ID/exec';

async function loadRefereeData(token) {
  showState('loading');
  try {
    const url = `${SCRIPT_URL}?token=${encodeURIComponent(token)}`;
    const res = await fetch(url); // No options needed
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!data.ok) {
      showState('error', { message: data.message, assignorEmail: data.assignorEmail || '' });
      return;
    }

    if (data.deadlineState === 'hard_closed') {
      showState('closed', data);
      return;
    }

    populateForm(data);
    if (data.deadlineState === 'late') {
      document.getElementById('late-banner').style.display = '';
    }
    showState('form');

  } catch (err) {
    showState('error', { message: err.message, assignorEmail: '' });
  }
}
```

### Frontend: State Switcher Pattern

```javascript
// Show exactly one state panel at a time
const STATES = ['loading', 'form', 'closed', 'error', 'success'];

function showState(name, data) {
  STATES.forEach(s => {
    document.getElementById('state-' + s).style.display = s === name ? '' : 'none';
  });
  if (data) populateStateContent(name, data);
}
```

### Deadline State Display in Late Banner

```javascript
// Populate late banner with the formatted deadline date
function populateForm(data) {
  document.getElementById('late-banner-date').textContent = data.deadlineDisplay;
  // ... rest of pre-fill
}
```

```html
<!-- Late banner structure -->
<div class="late-banner" id="late-banner" style="display:none">
  The deadline was <strong id="late-banner-date"></strong>.
  You can still submit, but your response will be marked as late.
</div>
```

### submitDetails POST Call (same CORS pattern as Phase 2)

```javascript
// Source: Phase 2 nominatev2 pattern (verified working)
async function submitDetails(token, formData) {
  const btn = document.getElementById('sub-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>Submitting...';

  try {
    const payload = {
      action: 'submitDetails',
      token: token,
      phone: formData.phone,
      age: formData.age,
      refWeekend1: formData.refWeekend1,
      refWeekend2: formData.refWeekend2,
      hotelWkd1: formData.hotelWkd1,
      hotelWkd2: formData.hotelWkd2,
      gender: formData.gender,
      availability: formData.availability,
      refNotes: formData.refNotes
    };

    // No Content-Type header — avoids CORS preflight (verified Phase 2 pattern)
    const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!data.ok) {
      if (data.error === 'hard_closed') {
        showState('closed', { assignorEmail: ASSIGNOR_EMAIL });
      } else {
        throw new Error(data.message || 'Submission failed.');
      }
      return;
    }

    showState('success', { formData, lateFlag: data.lateFlag });

  } catch (err) {
    showInlineError(err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = isReturnVisit ? 'Update Details' : 'Submit Details';
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| DRA provides all referee details | Referee provides own details via token link | v2.0 pivot (2026-03-19) |
| Single doPost-only Apps Script | doGet + doPost in same project | doGet added in Phase 3 |
| No deadline enforcement | deadline / grace period / hard-close states | Full state machine in both backend and frontend |

**Column changes from v1.0 (already done in Phase 1 schema):**
- Column X: was `RefHotel` (DRA-written), now `LateFlag` (system-written by submitDetails)
- Columns N, O, P: writer changed from DRA form to referee form

---

## Open Questions

1. **Column M (Availability) usage**
   - What we know: CONTEXT.md says Claude's discretion — may hold a summary string or stay empty
   - What's unclear: Whether a summary (e.g., "W1: Yes, W2: No") adds value for the assignor
   - Recommendation: Write a summary string derived from RefWeekend1/RefWeekend2 values.
     Example: `payload.availability = wkd1 + ' / ' + wkd2`. This is cheap to compute and gives
     the assignor a quick-glance column in the sheet without opening V/W.

2. **RefWeekend1/RefWeekend2 column values (V and W)**
   - What we know: CONTEXT.md says Claude's discretion on exact text
   - Recommendation: Use `'Yes'` and `'No'` — matches the toggle UI language, simple to filter
     in Google Sheets, consistent with LateFlag `'Y'` / `''` pattern.

3. **Success state design**
   - What we know: CONTEXT.md says Claude's discretion (inline summary or toast)
   - Recommendation: Inline summary card (same pattern as Phase 2 success state). Show:
     Weekend 1 availability, Weekend 2 availability, hotel selections, phone, notes.
     Simpler than a toast for mobile users who may want to screenshot their response.

4. **doPost routing: add to nominatev2.gs or separate file?**
   - What we know: GAS compiles all .gs files together; one doPost per project
   - Recommendation: Add `submitDetails` case to the switch in `nominatev2.gs` doPost.
     Define `_handleSubmitDetails` in `refdetails.gs`. This keeps doPost routing centralized
     and the helper function in the Phase 3 file.

5. **REF_FORM_URL property update**
   - What we know: Phase 2 set `REF_FORM_URL = 'TBD'` in PropertiesService
   - Recommendation: After deploying the new Apps Script version in Phase 3, run
     `setTournamentConstants()` again to update `REF_FORM_URL` with the new /exec URL. Also
     update the HTML file's `SCRIPT_URL` constant.

---

## Sources

### Primary (HIGH confidence)

- Existing codebase — `scripts/nominatev2.gs`: LockService pattern, `_jsonResponse` helper,
  token generation, column constants, PropertiesService usage — all carry forward directly
- Existing codebase — `spring-state-cup-nomination.html`: Complete CSS variable set, component
  classes, fetch POST pattern without Content-Type, spinner, state display patterns
- Existing codebase — `.planning/COLUMN-MAP.md`: Authoritative column index map (COL_* constants)
  for all A-Z columns; named range definition for ConfirmationDeadline at Z1
- Existing codebase — `.planning/phases/03-referee-detail-form/03-CONTEXT.md`: All locked
  decisions (deadline logic, hotel visibility, no dedicated limitation field, Yes/No toggles)
- GAS docs `e.parameter` — query parameters accessible via `e.parameter.token` in doGet
- GAS docs `Spreadsheet.getRangeByName` — returns null if named range not found (verified via
  official reference)

### Secondary (MEDIUM confidence)

- tanaikech gist "Sample Scripts for Requesting to Web Apps" — confirms simple `fetch(url)` with
  no options works for "anyone anonymous" GAS deployments, response parseable as JSON
- ramblings.mcpher.com — confirms CORS works (body readable) only for "anyone even anonymous"
  deployed GAS; restricted-access deployments return CORS errors
- GAS docs "Web Apps" (developers.google.com/apps-script/guides/web) — confirms doGet and doPost
  can coexist in one project, `e.parameter` for GET query strings

### Tertiary (LOW confidence)

- Search result consensus on CORS behavior — multiple sources agree that `mode: no-cors` makes
  response body unreadable; simple fetch is the correct approach for public GAS deployments.
  Not verified via official CORS specification but consistent across multiple community sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components inherited from Phase 2 codebase; no new libraries
- Architecture / doGet pattern: HIGH — GAS docs + Phase 2 codebase patterns; doGet is standard GAS
- CORS fetch behavior: MEDIUM — community sources consistently confirm simple fetch works for
  "anyone anonymous" deployments; official GAS docs don't explicitly state this but it's proven
  in Phase 2 with POST
- Deadline/named range logic: HIGH — GAS docs confirm getRangeByName returns null if not found;
  getValue returns Date for date cells; date arithmetic is standard JavaScript
- Column map: HIGH — directly from COLUMN-MAP.md (Phase 1 source of truth)
- Pitfalls: HIGH for deploy and CORS pitfalls (proven in Phase 2); MEDIUM for timezone/date edge cases

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable GAS APIs; deployment behavior is well-established)
