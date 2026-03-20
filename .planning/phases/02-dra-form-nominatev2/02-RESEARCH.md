# Phase 2: DRA Form + nominateV2 - Research

**Researched:** 2026-03-19
**Domain:** Google Apps Script doPost handler + static HTML form (SheetJS spreadsheet upload)
**Confidence:** HIGH — research drawn from existing codebase and well-understood Apps Script patterns

---

## Summary

Phase 2 is a targeted evolution of the existing v1.0 nomination form. The v1.0 form
(`spring-state-cup-nomination.html`) already implements the complete visual pattern, SheetJS
upload, DRA dropdown with auto-fill, dynamic referee card list, drag-and-drop, and
POST-to-Apps-Script submit flow. v2.0 simplifies it: 6 fields per referee instead of 13, an
append model for upload, and a smarter backend that handles deduplication by email.

The nominateV2 Apps Script handler is the highest-complexity piece. It must: (1) search
column H for an existing email match, (2) update or append accordingly, (3) generate a UUID
token only for new rows, (4) hold a LockService lock for the entire batch write to prevent
race conditions, and (5) return per-nominee new/updated status to the frontend. PropertiesService
stores tournament constants (assignor email, form URL, weekend dates) so they are never
hardcoded in the deployed handler.

**Primary recommendation:** Adapt v1.0 HTML directly — strip removed fields, update template
headers, change submit payload structure. Write nominateV2.gs as a new file in the scripts
directory that is pasted into the Apps Script editor alongside setup-schema-v2.gs.

---

## Standard Stack

### Core

| Component | Version / Source | Purpose | Notes |
|-----------|------------------|---------|-------|
| SheetJS (XLSX) | 0.20.3 (CDN, already in v1.0) | Parse .xlsx/.xls/.csv upload, generate template | Already pinned with SRI hash in v1.0 |
| Google Apps Script | V8 runtime (current) | doPost handler, sheet writes, LockService, PropertiesService | No npm — paste .gs into Apps Script editor |
| SpreadsheetApp | Built-in GAS service | Read/write Google Sheet rows | getDataRange, appendRow, getRange, setValues |
| LockService | Built-in GAS service | Serialize concurrent writes | `LockService.getScriptLock()` |
| PropertiesService | Built-in GAS service | Store tournament constants | `PropertiesService.getScriptProperties()` |
| Utilities.getUuid() | Built-in GAS service | Generate UUID tokens | Native — no library needed |

### Supporting

| Component | Purpose | Notes |
|-----------|---------|-------|
| Open Sans (Google Fonts CDN) | Typography — already in v1.0 | Keep existing link tag |
| HTML5 FileReader API | Read uploaded file as ArrayBuffer for SheetJS | Browser-native, no dependency |
| Fetch API | POST JSON to Apps Script URL | Browser-native, already used in v1.0 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SheetJS (keep) | CSV-only parsing | SheetJS already in v1.0 at 0.20.3 with SRI; handles .xlsx natively; template download requires it; no reason to remove |
| SheetJS CDN | npm bundle | This is a static HTML file with no build step — CDN is the only option |

**Installation:** No npm. SheetJS loaded via CDN (already present in v1.0):
```html
<script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"
  integrity="sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT"
  crossorigin="anonymous"></script>
```

---

## Architecture Patterns

### Recommended File Structure

```
/
├── spring-state-cup-nomination.html    # v2.0 DRA form (replaces v1.0)
└── scripts/
    ├── setup-schema-v2.gs              # Phase 1 (done)
    ├── verify-schema-v2.gs             # Phase 1 (done)
    └── nominatev2.gs                   # Phase 2 (new — paste into Apps Script editor)
```

The v2.0 form replaces the v1.0 HTML file in place. The .gs file is pasted into the Apps Script
editor as an additional script file in the same project as setup-schema-v2.gs.

### Pattern 1: nominateV2 doPost Handler Structure

**What:** Apps Script web app receives a POST with `action=nominateV2` and a `rows` array.
For each referee: find existing row by email, update DRA columns only if found, append new row
if not found. Return per-row new/updated status.

**When to use:** Always — this is the only action Phase 2 needs.

```javascript
// nominatev2.gs — top-level structure
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);

    // Honeypot spam check
    if (payload.website) {
      return _jsonResponse({ ok: true, results: [] }); // silent reject
    }

    if (payload.action !== 'nominateV2') {
      return _jsonResponse({ ok: false, error: 'Unknown action' });
    }

    return _handleNominateV2(payload.rows);

  } catch (err) {
    return _jsonResponse({ ok: false, error: err.message });
  }
}

function _handleNominateV2(rows) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000); // wait up to 15s, throws if timeout

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    var results = [];

    // Deduplicate within the submitted batch by email (last-wins for duplicates)
    var seen = {};
    var deduped = [];
    for (var i = 0; i < rows.length; i++) {
      var email = (rows[i].ref_email || '').trim().toLowerCase();
      if (email) {
        seen[email] = rows[i]; // last-wins
      } else {
        deduped.push(rows[i]); // no-email rows always append
      }
    }
    for (var k in seen) { deduped.push(seen[k]); }

    // Load all existing emails once (not per-row)
    var existingEmails = _loadEmailIndex(sheet);

    for (var j = 0; j < deduped.length; j++) {
      var row = deduped[j];
      var refEmail = (row.ref_email || '').trim().toLowerCase();
      var existingRowNum = refEmail ? existingEmails[refEmail] : null;

      if (existingRowNum) {
        _updateDraColumns(sheet, existingRowNum, row);
        results.push({ name: row.first + ' ' + row.last, status: 'updated' });
      } else {
        var token = Utilities.getUuid();
        _appendNewRow(sheet, row, token);
        // Update local index so duplicates within batch are caught
        if (refEmail) existingEmails[refEmail] = sheet.getLastRow();
        results.push({ name: row.first + ' ' + row.last, status: 'new' });
      }
    }

    return _jsonResponse({ ok: true, results: results });

  } finally {
    lock.releaseLock();
  }
}
```

### Pattern 2: Email Index Load (read all at once, not per-row)

**What:** Load all existing emails from column H into a `{email: rowNumber}` map once before
the loop. Critical for performance — a sheet with 200 rows should not make 200 x N read calls.

**When to use:** Always — single bulk read, then O(1) lookup per row.

```javascript
function _loadEmailIndex(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return {}; // header only

  var emails = sheet.getRange(2, COL_REF_EMAIL, lastRow - 1, 1).getValues();
  var index = {};
  for (var i = 0; i < emails.length; i++) {
    var em = String(emails[i][0] || '').trim().toLowerCase();
    if (em) index[em] = i + 2; // +2: 1-based, skip header row
  }
  return index;
}
```

### Pattern 3: Update Existing Row (DRA Columns Only)

**What:** When referee email exists, overwrite only columns A-H and Q. Never touch I-P (referee
detail columns), R (token), S (status), or any other column.

**Key constraint:** Use individual cell writes or a range-per-column approach — do NOT use
setValues on a wide range that would overwrite columns I-P.

```javascript
function _updateDraColumns(sheet, rowNum, row) {
  var ts = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
  // Write A-H as a single contiguous range
  sheet.getRange(rowNum, COL_TIMESTAMP, 1, 8).setValues([[
    ts,
    row.dra,
    row.dra_email,
    row.district,
    row.ref_num,
    row.first,
    row.last,
    row.ref_email
  ]]);
  // Write Q (DRA Notes) separately — column 17, not contiguous with A-H
  sheet.getRange(rowNum, COL_DRA_NOTES).setValue(row.notes || '');
  // Token (R), Status (S), and all other columns are intentionally NOT touched
}
```

### Pattern 4: Append New Row

**What:** For new referees, write a full row. Columns I-P are left blank. Token goes in R.
Status defaults to "Not Sent" in S.

```javascript
function _appendNewRow(sheet, row, token) {
  var ts = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
  // Build 19-column array (A through S). Columns I-P (indices 8-15) are blank.
  var newRow = [
    ts,             // A  col 1  Timestamp
    row.dra,        // B  col 2  DRA Name
    row.dra_email,  // C  col 3  DRA Email
    row.district,   // D  col 4  District
    row.ref_num,    // E  col 5  Referee #
    row.first,      // F  col 6  First Name
    row.last,       // G  col 7  Last Name
    row.ref_email,  // H  col 8  Referee Email
    '',             // I  col 9  Phone         — blank (referee fills Phase 3)
    '',             // J  col 10 Age           — blank
    '',             // K  col 11 Max Age as AR — blank
    '',             // L  col 12 Max Age as Ref— blank
    '',             // M  col 13 Availability  — blank
    '',             // N  col 14 Gender        — blank
    '',             // O  col 15 Hotel Wkd 1   — blank
    '',             // P  col 16 Hotel Wkd 2   — blank
    row.notes || '', // Q col 17 DRA Notes
    token,          // R  col 18 Token
    'Not Sent'      // S  col 19 Status
  ];
  sheet.appendRow(newRow);
}
```

### Pattern 5: PropertiesService for Tournament Constants

**What:** Store assignor email, form URL, and weekend dates in Script Properties so they are
never hardcoded in the deployed handler. Readable by any phase without redeployment.

```javascript
// One-time setup (run manually from Apps Script editor):
function setTournamentProperties() {
  var props = PropertiesService.getScriptProperties();
  props.setProperties({
    'ASSIGNOR_EMAIL': 'assignor@tnsoccer.org', // replace at setup time
    'WEEKEND_1': 'May 16 & 17, 2026',
    'WEEKEND_2': 'May 23 & 24, 2026',
    'REF_FORM_URL': 'https://...' // Phase 3 URL — set when known
  });
}

// Reading in any handler:
var props = PropertiesService.getScriptProperties();
var assignorEmail = props.getProperty('ASSIGNOR_EMAIL');
```

### Pattern 6: JSON Response Helper

**What:** Apps Script doPost must always return a ContentService TextOutput with MIME JSON.
A shared helper prevents copy-paste errors.

```javascript
function _jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### Pattern 7: v2.0 Form Field Structure Per Referee Card

The v2.0 referee card is simpler than v1.0. All removed fields (phone, age, availability,
hotel, day notes) are gone. What remains:

```
First Name (required)    Last Name (required)
Email (required)
Max Age as AR (required) — dropdown U12-U19
Max Age as Referee (required) — dropdown U12-U19
DRA Notes (optional) — textarea
```

Age dropdowns: U12, U13, U14, U15, U16, U17, U18, U19 — no Adult/Open option.
Email is required in v2.0 (v1.0 treated it as optional). Required because email is the
deduplication key — a nomination without email cannot be deduped across DRAs.

### Pattern 8: Upload — Append, Not Replace

v1.0 upload clears the ref-list and replaces it. v2.0 upload appends to any existing manual
entries. This requires a small change to the upload handler: remove the
`document.getElementById('ref-list').innerHTML = ''` and `rc = 0` lines from `handleUpload`,
and let the upload add cards after any already present.

### Pattern 9: v2.0 Template Headers (Simplified)

```javascript
const TEMPLATE_HEADERS = [
  'First Name', 'Last Name', 'Email',
  'Max Age as AR', 'Max Age as Referee',
  'DRA Notes'
];
```

Required columns for upload validation: First Name, Last Name, Email.
(Email required because it is the dedup key — rows without email cannot be matched.)

### Anti-Patterns to Avoid

- **Writing I-P columns during nominateV2:** Any setValues call that covers columns 9-16 will
  overwrite referee-provided data. Write A-H as one 8-column range, Q as a single cell.
- **Reading sheet row-by-row inside the loop:** Load the full email index once before the loop,
  not N separate getValues calls.
- **Forgetting to release the lock:** Always use try/finally with `lock.releaseLock()`.
- **Using appendRow for updates:** appendRow always adds a new row. Updates must use
  `sheet.getRange(rowNum, ...)`.
- **Not normalizing email for comparison:** Store and compare emails lowercase-trimmed. A DRA
  entering "Jane@Example.COM" should match an existing "jane@example.com".
- **Using GAS's built-in `MailApp` for email:** Out of scope for Phase 2, but noted: when
  Phase 4 needs email, it must use mailto links for Outlook, not MailApp.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID token generation | Custom random string | `Utilities.getUuid()` | Native GAS, RFC 4122 compliant |
| .xlsx file parsing | Manual binary parsing | SheetJS 0.20.3 (already in v1.0) | Handles all Excel formats and CSV |
| .xlsx template generation | Manual | SheetJS `XLSX.utils.aoa_to_sheet` + `XLSX.writeFile` | Already proven in v1.0 |
| Concurrent write protection | Manual state flags | `LockService.getScriptLock()` | GAS-native, correct for this use case |
| Tournament config storage | Hardcoded constants in .gs | `PropertiesService.getScriptProperties()` | Survives redeployment without code changes |

---

## Common Pitfalls

### Pitfall 1: Apps Script doPost Returns 302 Instead of 200

**What goes wrong:** fetch() on the frontend throws or receives an unexpected redirect response.
**Why it happens:** If the web app is deployed to "Execute as: Me" but "Who has access: Anyone"
is not set (or vice versa), or the script was never redeployed after code changes.
**How to avoid:** After pasting nominatev2.gs, create a NEW deployment (not edit existing).
"Execute as: Me", "Who has access: Anyone (even anonymous)". Copy the new /exec URL.
**Warning signs:** Frontend fetch sees HTTP 302 or 403. Apps Script execution log shows no doPost calls.

### Pitfall 2: fetch() to Apps Script URL Fails with CORS

**What goes wrong:** Browser console shows CORS error on POST to apps script /exec URL.
**Why it happens:** Apps Script /exec URLs support CORS for POST only when the body is
sent without `Content-Type: application/json` (i.e., as raw string body). Setting
`Content-Type: application/json` triggers a CORS preflight that Apps Script does not handle.
**How to avoid:** Send `body: JSON.stringify(payload)` without setting Content-Type header.
This is what v1.0 already does correctly — do not add a `headers` property to the fetch call.

```javascript
// CORRECT (v1.0 pattern — keep this):
fetch(SHEET_URL, { method: 'POST', body: JSON.stringify(payload) })

// WRONG (triggers CORS preflight):
fetch(SHEET_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
})
```

### Pitfall 3: LockService Timeout in High-Concurrency Scenarios

**What goes wrong:** `lock.waitLock(15000)` throws if it cannot acquire within 15 seconds.
**Why it happens:** Multiple DRAs submitting large batches simultaneously.
**How to avoid:** Wrap the lock acquisition in a try/catch at the outer level (the
`doPost` try/catch handles it). The frontend receives `{ ok: false, error: "..." }` and
shows the error state with the assignor email for fallback contact.

### Pitfall 4: appendRow vs. getRange for Updates

**What goes wrong:** A referee who was re-nominated gets a second row instead of an updated row.
**Why it happens:** Using `appendRow` for both new and existing referees.
**How to avoid:** The `_loadEmailIndex` function returns the row number for existing emails.
Use that row number with `sheet.getRange(rowNum, ...)` for updates. Only call `appendRow`
for truly new entries.

### Pitfall 5: Email Index Stale During Batch Processing

**What goes wrong:** Two rows in the same submitted batch both have the same email. The second
one creates a duplicate row because `_loadEmailIndex` was called before the first was appended.
**How to avoid:** After appending a new row, immediately update the local `existingEmails` map:
`existingEmails[refEmail] = sheet.getLastRow()`. This is the recommended within-upload duplicate
handling approach (Claude's discretion item).

### Pitfall 6: SheetJS CDN Integrity Hash Mismatch

**What goes wrong:** SheetJS script fails to load; upload feature broken.
**Why it happens:** CDN URL and SRI hash must match the specific version.
**How to avoid:** Keep the exact CDN URL and integrity hash from v1.0:
```
https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js
sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT
```

### Pitfall 7: Column E (Referee #) in Batch Context

**What goes wrong:** Referee # (column E) is assigned sequentially within the submission batch
(i+1), but after deduplication the sequence numbers may have gaps or be wrong.
**How to avoid:** Assign ref_num after dedup, using the deduplicated array's index + 1.
This is cosmetic (used as a sheet reference number) — not a unique key. Sequential within
the batch is sufficient.

### Pitfall 8: Age Dropdown Includes "Adult / Open" in v1.0 — Must Be Removed

**What goes wrong:** v1.0 AGES array includes 'Adult / Open'. v2.0 decisions explicitly
exclude it — only U12-U19.
**How to avoid:** Update the AGES constant in the v2.0 form:
```javascript
const AGES = ['U12','U13','U14','U15','U16','U17','U18','U19'];
// Remove: 'Adult / Open'
```

### Pitfall 9: DRA List Has Placeholder Entries Needed at Implementation Time

**What goes wrong:** Context.md says to add Don Eubank, Mark Herrington (SRA), the SYRA,
and the Assignor — but their emails and district labels are not in the codebase.
**How to avoid:** These values are needed at task execution time, not just planning time.
The planner should include a task step to collect these values before writing the HTML,
or make them placeholder comments in the code for the implementer to fill in.
The existing 7 DRA entries in v1.0 are the known good values to carry forward.

---

## Code Examples

### doPost Action Dispatch (verified pattern from v1.0 + standard GAS docs)

```javascript
// Standard GAS web app entry point
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    if (payload.website) {
      // Honeypot — silent accept to not reveal spam detection
      return _jsonResponse({ ok: true, results: [] });
    }
    switch (payload.action) {
      case 'nominateV2': return _handleNominateV2(payload.rows);
      default: return _jsonResponse({ ok: false, error: 'Unknown action: ' + payload.action });
    }
  } catch (err) {
    return _jsonResponse({ ok: false, error: err.message });
  }
}
```

### Frontend Submit Payload (v2.0)

```javascript
// What the form POSTs to the Apps Script endpoint
const payload = {
  action: 'nominateV2',
  website: document.getElementById('hp-field').value, // honeypot
  rows: [
    {
      dra: 'Glen Garrett',
      dra_email: 'glengarrett24@gmail.com',
      district: 'Middle',
      ref_num: 1,
      first: 'Jane',
      last: 'Smith',
      ref_email: 'jane@example.com',
      max_ar: 'U17',
      max_ref: 'U19',
      notes: 'Strong center ref'
    }
    // ... more rows
  ]
};

// Fetch call — no Content-Type header (CORS requirement)
const res = await fetch(SHEET_URL, {
  method: 'POST',
  body: JSON.stringify(payload)
});
```

### Backend Response (v2.0)

```javascript
// Backend returns per-referee new/updated status
// { ok: true, results: [{ name: 'Jane Smith', status: 'new' }, { name: 'John Doe', status: 'updated' }] }
// { ok: false, error: 'Error message' }
```

### Frontend Summary Display (v2.0 — shows new vs. updated)

```javascript
// After successful submission
results.forEach(r => {
  const badge = r.status === 'new'
    ? '<span style="color:var(--green);font-size:11px;">(new)</span>'
    : '<span style="color:var(--muted);font-size:11px;">(updated)</span>';
  html += `<div class="sum-ref"><strong>${esc(r.name)}</strong> ${badge}</div>`;
});
```

### PropertiesService Setup Function

```javascript
// Run once manually from Apps Script editor after deployment
// This satisfies API-08: tournament constants in PropertiesService
function setTournamentConstants() {
  PropertiesService.getScriptProperties().setProperties({
    'ASSIGNOR_EMAIL': 'TBD',          // fill at setup time
    'WEEKEND_1_DATES': 'May 16 & 17, 2026',
    'WEEKEND_2_DATES': 'May 23 & 24, 2026',
    'REF_FORM_URL': 'TBD'             // Phase 3 URL — set when known
  });
  Logger.log('Tournament constants saved to Script Properties.');
}
```

---

## State of the Art

| Old (v1.0) | New (v2.0) | Impact |
|------------|------------|--------|
| 13 fields per referee card | 6 fields per card | Simpler form, faster DRA entry |
| Upload replaces manual entries | Upload appends to manual entries | DRAs can mix both in one submission |
| No deduplication — always appends | Email-based dedup across DRAs | No duplicate rows; cross-DRA updates |
| No token in nomination | UUID token at nominateV2 time | Enables referee self-service links (Phase 3) |
| All fields written by DRA | DRA writes A-H, Q; referee writes I-P | Writer separation enforced at handler level |
| AGES includes "Adult / Open" | AGES is U12-U19 only | Matches v2.0 tournament constraints |
| No action field in payload | `action: 'nominateV2'` in payload | Prepares for multi-action doPost routing |

---

## Open Questions

1. **New DRA email/district values**
   - What we know: Context.md says add Don Eubank, Mark Herrington (SRA), the SYRA, and the Assignor
   - What's unclear: Their emails and district labels are not in any existing file
   - Recommendation: Plan task includes a step to collect these values at implementation time,
     with placeholder comments in the code

2. **Assignor email for PropertiesService**
   - What we know: Jess Erickson (`jerickson@tnsoccer.org`) is referenced in v1.0 error text
   - What's unclear: Whether this is still the correct assignor email for v2.0
   - Recommendation: Use `jerickson@tnsoccer.org` as the default; plan task notes it should
     be confirmed when `setTournamentConstants()` is run

3. **Apps Script URL for v2.0**
   - What we know: v1.0 uses `AKfycbx...` URL; the TEST.html uses a different `AKfycby...` URL
   - What's unclear: Whether a new deployment is needed or the existing project will be updated
   - Recommendation: Phase 2 plan should include a deploy step; the existing Apps Script project
     gains a new file (`nominatev2.gs`) and gets redeployed as a new version

---

## Sources

### Primary (HIGH confidence)

- Existing codebase — `spring-state-cup-nomination.html` (v1.0): Complete working form with SheetJS
  upload, DRA dropdown, dynamic cards, fetch POST pattern, and summary display
- Existing codebase — `scripts/setup-schema-v2.gs`: Column map, COL_* constants, Status values,
  schema structure — canonical source of truth for column indices
- Existing codebase — `scripts/verify-schema-v2.gs`: Confirms schema expectations

### Secondary (MEDIUM confidence)

- Google Apps Script documentation (training data, August 2025 cutoff): LockService.getScriptLock(),
  PropertiesService.getScriptProperties(), Utilities.getUuid(), ContentService,
  SpreadsheetApp.appendRow(), sheet.getRange().setValues()
- Apps Script CORS behavior (well-documented community pattern, verified in v1.0): fetch POST
  without Content-Type header is required to avoid CORS preflight failure

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — SheetJS version, CDN URL, and SRI hash all taken from existing v1.0 file
- Architecture / column mapping: HIGH — directly from setup-schema-v2.gs constants
- doPost patterns: HIGH — standard GAS patterns well-established, consistent with v1.0
- Pitfalls: HIGH for CORS and lock patterns (verified from v1.0 and GAS docs); MEDIUM for
  concurrent submission edge cases (theoretical but standard GAS guidance)
- New DRA list entries: LOW — emails and districts are not in any existing file

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable tech stack; SheetJS and GAS APIs are stable)
