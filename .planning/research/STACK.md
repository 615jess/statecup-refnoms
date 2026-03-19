# Stack Research: v2.0 Referee Detail Collection

**Project:** State Cup Referee Nominations — v2.0 Milestone
**Domain:** Token-secured referee self-service form with deadline enforcement
**Researched:** 2026-03-19
**Replaces:** v1.0 STACK.md (2026-03-17) — that document remains valid for foundations; this document covers only what is NEW or CHANGED for v2.0.

---

## What This Document Covers

v2.0 pivots the workflow:

- **Before (v1.0):** DRA provides all referee details; referee only confirms/declines.
- **After (v2.0):** DRA provides name + email only; referee provides all details via a token-secured form.

The existing Apps Script, Google Sheet, and GitHub Pages hosting are unchanged in kind, but several capabilities are NEW:

1. Simplified DRA form (drops SheetJS, drops 12 fields per referee)
2. Referee detail form with more fields than the v1.0 confirmation form
3. doGet returns context (tournament dates, assignor contact, DRA name, deadline)
4. Token reuse for re-nominated referees (upsert, not always insert)
5. Deadline enforcement: read-only form after deadline; late-flag for pre-deadline submissions that arrive after a soft cutoff
6. Admin page with mailto links (replaces the Google Sheet menu trigger from v1.0)
7. Sheet column restructure for v2.0 (DRA-submitted columns shrink; referee-submitted columns expand)

---

## Unchanged Stack (Do Not Revisit)

The following were validated in v1.0 STACK.md and are not affected by the v2.0 pivot:

| Component | Decision | Status |
|-----------|----------|--------|
| `Utilities.getUuid()` | Token generation | Locked |
| `doGet` / `doPost` with action routing | Single endpoint, query param dispatch | Locked |
| `ContentService.createTextOutput().setMimeType(JSON)` | JSON API responses | Locked |
| `URLSearchParams` | Token reading on GitHub Pages static page | Locked |
| `LockService.getScriptLock()` | Concurrent write guard on doPost | Locked |
| Google Sheets as data store | No database migration | Locked |
| GitHub Pages static HTML | No server-side rendering | Locked |
| Open Sans + navy/red/gold CSS variables | Visual style consistency | Locked |
| `ss.getRangeByName('ConfirmationDeadline')` | Deadline stored in Z1 named range | Locked |

---

## Section 1: SheetJS — REMOVE from DRA Form

### Decision: Drop SheetJS entirely

The v1.0 DRA form uses SheetJS (`xlsx-0.20.3`) for spreadsheet template download and bulk upload. In v2.0, the DRA form collects only name + email per referee. There is no spreadsheet data to upload.

**Remove:**
```html
<script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"
  integrity="sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT"
  crossorigin="anonymous"></script>
```

And remove `downloadTemplate()`, `handleUpload()`, `clearUpload()`, all upload zone HTML, and the `TEMPLATE_HEADERS` constant.

**Why remove rather than keep:** The upload feature solves the problem of entering 14 fields per referee. At 2 fields (name + email), the upload feature adds UI complexity with zero benefit. Dead code in the form creates maintenance confusion and adds ~500KB of parse/execute overhead.

**Confidence: HIGH** — SheetJS version 0.20.3 is verified in the existing `spring-state-cup-nomination.html` line 8.

---

## Section 2: doGet Response Shape — New Fields Required

### What changed

v1.0 doGet returned only the referee's nomination row data so the confirmation form could pre-fill.

v2.0 doGet must also return **context** that the referee form needs to display and that cannot be derived from the row itself:

| Field | Source | Why Needed |
|-------|--------|-----------|
| `tournamentDates` | Hardcoded constant in script | Display weekend dates on form |
| `assignorContact` | Script Properties (`ASSIGNOR_EMAIL`) | "Contact X if you have questions" |
| `draName` | Row column B | "You were nominated by [DRA]" |
| `deadlineDate` | Named range `ConfirmationDeadline` at Z1 | Deadline notice, late-flag logic |
| `isLate` | Computed: `new Date() > deadline` | Show late-submission notice to referee |
| `isPastDeadline` | Computed: deadline check | Return read-only flag; enforce server-side |

### Recommended doGet response shape

```javascript
{
  ok: true,
  data: {
    // Referee identity
    firstName: string,
    lastName: string,
    refEmail: string,         // pre-fill contact field
    // Nomination context
    draName: string,
    nominatedWeekends: string, // e.g. "Weekend 1, Weekend 2"
    // Referee-previously-submitted data (null if first visit)
    refAge: string,
    refGender: string,
    refPhone: string,
    refAvailability: string,
    refHotelWk1: string,
    refHotelWk2: string,
    refNotes: string,
    // Submission state
    status: string,           // "Not Sent" | "Pending" | "Submitted" | "Late"
    submittedAt: string,      // ISO string or empty
    // Form behavior flags
    isLate: boolean,          // true if now > deadline but isPastDeadline is false
    isPastDeadline: boolean,  // true if deadline is enforced and form should be read-only
    // Tournament context
    deadlineDate: string,     // ISO string from Z1 named range
    tournamentYear: string,   // "2026"
    weekend1Dates: string,    // "May 16–17"
    weekend2Dates: string,    // "May 23–24"
    assignorEmail: string     // from Script Properties
  }
}
```

### Where context comes from

**Tournament dates and assignor email:** Store as Script Properties (`PropertiesService.getScriptProperties()`), not in the sheet. These never change during a cycle and are not data the assignor would edit in the sheet. Script Properties are the Apps Script-native mechanism for developer configuration constants.

**Recommended Script Properties:**
```
ASSIGNOR_EMAIL     → "jerickson@tnsoccer.org"
TOURNAMENT_YEAR    → "2026"
WEEKEND_1_DATES    → "May 16–17"
WEEKEND_2_DATES    → "May 23–24"
CONFIRM_PAGE_URL   → "https://[org].github.io/StateCup_RefNoms/referee-details.html"
```

**Deadline date:** Continue using the `ConfirmationDeadline` named range at Z1, which the assignor edits directly in the sheet. This is the right split: the date changes per cycle and is the assignor's responsibility to set. Script Properties are for developer-set constants.

**DRA name:** From column B of the referee's row (already in the sheet).

**Confidence: HIGH** — PropertiesService is core Apps Script, documented at developers.google.com/apps-script/guides/properties. Named range read via `ss.getRangeByName('ConfirmationDeadline').getValue()` is established from v1.0.

---

## Section 3: Deadline Enforcement — Two Tiers

### v2.0 requirement

The deadline has two distinct behaviors:

| Condition | Behavior |
|-----------|----------|
| Submitted before deadline | Normal submission, no notice |
| Submitted after deadline but form is still open | Submit succeeds; late flag written to sheet; referee sees a notice |
| Submitted after deadline AND form is locked | doPost returns error; form is read-only |

### Implementation approach

**Server-side (doGet + doPost):**

```javascript
function getDeadlineStatus() {
  var deadline = SpreadsheetApp.getActiveSpreadsheet()
    .getRangeByName('ConfirmationDeadline').getValue();
  var now = new Date();
  var isPastDeadline = deadline && now > new Date(deadline);
  return { deadline: deadline, isPastDeadline: isPastDeadline };
}
```

The doPost handler checks `isPastDeadline` before writing. If past deadline, return an error JSON. If late (after a soft cutoff), write to sheet AND set a `LateFlag` column to `"Yes"`.

**Client-side (referee-details.html):**

The client reads `isLate` and `isPastDeadline` from the doGet response. It does NOT independently compute deadline state — it trusts the server response. Client-side reads are UX-only:

```javascript
if (data.isPastDeadline) {
  // Show read-only form: disable all inputs, hide submit button
  document.querySelectorAll('input, select, textarea').forEach(function(el) {
    el.disabled = true;
  });
  showState('closed');
}
if (data.isLate && !data.isPastDeadline) {
  document.getElementById('late-notice').style.display = 'block';
}
```

**Critical:** `disabled` (not `readonly`) is the correct attribute for a fully locked form because disabled inputs cannot be modified at all by the user. Do not rely on client-side enforcement for security — the doPost server-side check is authoritative.

**Confidence: HIGH** — `disabled` vs `readonly` behavior is well-established HTML specification. Server-side deadline check pattern is standard web development.

---

## Section 4: Token Reuse for Re-Nominated Referees

### v2.0 requirement

If a referee is re-nominated (same email address appears in a new DRA submission), the system must:
- Reuse the existing token (same link stays valid)
- NOT create a duplicate row
- Update the row's nomination metadata (DRA name, nomination date) if changed

### Implementation: Email-based deduplication in doPost (nomination)

When the DRA submits a nomination, before appending a new row, scan column H (referee email) for a match:

```javascript
function findRowByEmail(sheet, email) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][7] === email) {  // col H = 0-based index 7
      return i + 1; // 1-based row number
    }
  }
  return null;
}
```

**If existing row found:** Update nomination metadata (DRA, district, timestamp) in columns A-D. Preserve the existing token in column R. Do not reset Status — if referee already submitted, keep that data.

**If no existing row:** Append new row as before. Token column is blank at this stage (token is generated when the admin page loads, not at nomination time).

**When to generate the token:** v2.0 moves token generation from email-send time (v1.0) to admin page load time. The admin page calls `?action=getAdminData`, which generates tokens for any row that doesn't have one yet. This matches the PROJECT.md decision: "DRA nominates → assignor sends emails via admin page."

**Confidence: HIGH** — `getDataRange().getValues()` column scan is core Apps Script, established pattern from v1.0 token lookup. Email deduplication is a standard array search.

---

## Section 5: Admin Page — mailto Links (Not Sheet Menu)

### v2.0 change from v1.0

v1.0 architecture used a Google Sheet custom menu (`SpreadsheetApp.getUi().createMenu()`) to trigger MailApp email sending. v2.0 uses **mailto links** because the assignor is on Microsoft 365/Outlook and wants manual control over each email.

The admin page is a GitHub Pages static HTML file that:
1. Loads all nominated referees from Apps Script via GET (`?action=getAdminData`)
2. Displays each referee with their current status
3. Generates a `mailto:` link per referee that opens Outlook with a pre-written email

### mailto link construction

The mailto link embeds the referee's personalized email body. Constraints:

**URL encoding:** All body text must be `encodeURIComponent()`-encoded. Line breaks are `%0D%0A`.

**Length limit:** The complete mailto URL (including `mailto:`, `?subject=`, `&body=`) must stay under ~2000 characters to reliably open Outlook on Windows. This is a well-known Windows/Outlook limitation.

**Content strategy:** Keep the email body short. Include referee name, tournament name + dates, and the token link. Move verbose instructions to the confirmation page itself, not the email.

```javascript
function buildMailtoLink(referee) {
  var subject = encodeURIComponent(
    'State Cup 2026 — Please Provide Your Referee Details'
  );
  var body = encodeURIComponent(
    'Hi ' + referee.firstName + ',\r\n\r\n' +
    'You have been nominated for the Spring State Cup 2026 ' +
    '(Weekend 1: May 16-17 / Weekend 2: May 23-24).\r\n\r\n' +
    'Please click the link below to provide your details:\r\n' +
    referee.detailsUrl + '\r\n\r\n' +
    'Deadline: ' + referee.deadlineFormatted + '\r\n\r\n' +
    'Questions? Email ' + ASSIGNOR_EMAIL + '\r\n\r\n' +
    'Thanks,\r\nJess'
  );
  return 'mailto:' + referee.refEmail + '?subject=' + subject + '&body=' + body;
}
```

**Check length before rendering:**
```javascript
if (link.length > 1800) {
  // flag in admin UI — body too long for Outlook
}
```

**No MailApp/GmailApp.** The assignor is on Microsoft 365. MailApp would send from the Google account running the script, not from the assignor's Outlook. See v1.0 STACK.md Section 1 for the full rationale. This constraint is locked.

**Confidence: HIGH** for mailto encoding. MEDIUM for the ~2000-char limit (consistent across Outlook versions but not officially documented by Microsoft as a fixed spec).

---

## Section 6: Sheet Column Structure — v2.0 Rethink

### Problem

v1.0 columns A-Q assumed the DRA submits 14 fields per referee. v2.0 DRAs submit only name + email. The v1.0 columns I-Q (Phone, Age, Max AR, Max Referee, Availability, Hotel Wk1, Hotel Wk2, Day Notes, DRA Notes) either disappear from the nomination or move to the referee-submitted section.

### Recommended v2.0 column structure

**DRA-submitted columns (A-H, 8 columns):**

| Col | Header | Source |
|-----|--------|--------|
| A | Timestamp | Auto (submission time) |
| B | DRAName | DRA form |
| C | DRAEmail | DRA form |
| D | District | DRA form |
| E | RefNum | DRA form (sequential within submission) |
| F | FirstName | DRA form |
| G | LastName | DRA form |
| H | RefEmail | DRA form (required) |

**System columns (I-L, 4 columns):**

| Col | Header | Source |
|-----|--------|--------|
| I | Token | Generated on admin page load |
| J | Status | Not Sent / Pending / Submitted / Late |
| K | SentAt | Timestamp when admin page generates token |
| L | SubmittedAt | Timestamp when referee submits |

**Referee-submitted columns (M-V, 10 columns):**

| Col | Header | Source |
|-----|--------|--------|
| M | RefAge | Referee form |
| N | RefGender | Referee form |
| O | RefPhone | Referee form |
| P | RefWeekend1 | Referee form (Yes/No) |
| Q | RefWeekend2 | Referee form (Yes/No) |
| R | RefHotelWk1 | Referee form (Yes/No, conditional) |
| S | RefHotelWk2 | Referee form (Yes/No, conditional) |
| T | RefDayNotes | Referee form (free text) |
| U | RefNotes | Referee form (free text) |
| V | LateFlag | Auto ("Yes" if submitted after soft deadline) |

**Deadline/config area (W1):**

`ConfirmationDeadline` named range moves to W1 (or stays at Z1 — placement is less important than the named range being used rather than hardcoded column indices).

**Note on v1.0 schema:** The v1.0 Phase 1 setup script wrote headers to R-Y (columns 18-25) based on the v1.0 DRA form having 17 columns (A-Q). v2.0 changes the DRA form to 8 columns, so all downstream column indices shift. The v1.0 setup scripts must be revised before the production sheet is touched. The note in STATE.md ("Production sheet may not have these applied yet") means no migration is needed — the v2.0 schema can be applied fresh.

**Confidence: HIGH** for structure decisions. The specific column letters are a roadmap decision (they belong in a phase plan, not locked here).

---

## Section 7: New Referee Form Fields

### Fields the referee provides that are new in v2.0

v1.0 confirmation form fields: weekend availability (2 checkboxes), hotel per weekend (2 checkboxes), notes (textarea). These were pre-filled from DRA data.

v2.0 referee form collects these new fields (not pre-fillable because DRA no longer submits them):

| Field | Type | Notes |
|-------|------|-------|
| Age | `<input type="number">` | Range 13-80, required |
| Gender | `<select>` | Standard options: Male, Female, Non-binary, Prefer not to say |
| Phone | `<input type="tel">` | Optional |
| Day-specific limitations | `<input type="text">` | "Saturday only on Weekend 1" |

These reuse the existing nomination form's CSS patterns (`.fld`, `.lbl`, `.g2`, `input[type=number]`, `select`). No new CSS classes needed.

**Email field:** Pre-filled from the sheet (referee's email is known from the nomination row). Show as readonly; referee can see it but not change it. This confirms they're on the right form.

**Confidence: HIGH** — these are standard HTML form elements, no library required.

---

## Section 8: PropertiesService for Assignor Contact + Tournament Constants

### Recommendation: Script Properties, not hardcoded strings

Store assignor-configurable but developer-set constants in Script Properties. This keeps them out of the HTML (avoiding another round of "replace YOUR_GOOGLE_SCRIPT_URL" instructions) and out of the sheet (avoiding confusion with nomination data).

**Setting properties (one-time setup in Apps Script):**
```javascript
function setupScriptProperties() {
  var props = PropertiesService.getScriptProperties();
  props.setProperties({
    'ASSIGNOR_EMAIL':  'jerickson@tnsoccer.org',
    'TOURNAMENT_YEAR': '2026',
    'WEEKEND_1_DATES': 'May 16-17',
    'WEEKEND_2_DATES': 'May 23-24',
    'CONFIRM_PAGE_URL': 'https://[org].github.io/StateCup_RefNoms/referee-details.html'
  });
}
```

**Reading in doGet:**
```javascript
var props = PropertiesService.getScriptProperties().getProperties();
// props.ASSIGNOR_EMAIL, props.WEEKEND_1_DATES, etc.
```

**Why not hardcode in script:** Next year's tournament will have different dates. Storing as properties means the assignor (or admin) can update them in the Apps Script editor's Project Settings without touching any JavaScript logic.

**Why not store in the sheet:** Tournament meta-constants are not data the assignor manages in a row. Mixing config into the sheet's named range area (Z, AA columns) creates confusion about what's data vs configuration.

**Confidence: HIGH** — `PropertiesService` is core, well-documented Apps Script. No quotas that matter at this scale. Values are strings only, which is fine for all these fields.

---

## What NOT to Add

| Do Not Add | Why Not | Use Instead |
|------------|---------|-------------|
| SheetJS (xlsx) | DRA form drops spreadsheet upload; dead dependency | Remove entirely |
| MailApp / GmailApp | Assignor is on Microsoft 365/Outlook — server-sent email goes from wrong account | mailto links in admin page |
| `SpreadsheetApp.getUi().createMenu()` | v2.0 replaces sheet menu trigger with admin HTML page | Admin page with mailto links |
| HtmlService for the referee form | Serves from script.google.com URL, not GitHub Pages domain; harder to style | Static GitHub Pages HTML + doGet JSON |
| JWT or session tokens | No multi-service auth needed; token-in-URL is the entire identity mechanism | `Utilities.getUuid()` in column I |
| External storage (Firestore, etc.) | Adds infrastructure complexity; Google Sheets handles 50-100 rows trivially | Existing Google Sheet |
| Input validation library (Zod, Yup, etc.) | No build toolchain; inline validation is 20 lines of vanilla JS | Vanilla JS validation (matches v1.0 pattern) |
| Date library (date-fns, Day.js, etc.) | Deadline comparison is one `new Date() > new Date(deadline)` expression | Native `Date` object |
| CSS framework (Tailwind, Bootstrap) | No build toolchain; existing inline CSS is already complete and maintained | Existing CSS variables from nomination form |

---

## Integration Summary: What Changes, What Stays

| Component | v1.0 State | v2.0 Change |
|-----------|-----------|-------------|
| `spring-state-cup-nomination.html` | Full 14-field referee entry + SheetJS upload | Simplify to name + email; remove SheetJS |
| `confirm.html` | Confirmation-only form (pre-filled from DRA data) | Replaced by `referee-details.html` (full detail collection) |
| `admin.html` | Did not exist (v1.0 used Sheet menu) | New page with mailto link generation |
| Apps Script `doGet` | Not yet implemented | Returns referee row + context (see Section 2 shape) |
| Apps Script `doPost` | Nomination only | Add two new action branches: `submitDetails` and `getAdminData` |
| Apps Script `onOpen()` menu | Planned (v1.0) | Not needed in v2.0 — replaced by admin page |
| Sheet columns A-Q | DRA-submitted 14-field nomination | Shrink to 8 DRA fields; rename/remap columns |
| Sheet columns R-Y | v1.0 confirmation schema | Replace with v2.0 schema (see Section 6) |
| Script Properties | Not used | Add for ASSIGNOR_EMAIL, tournament constants |

---

## Sources

- [Properties Service Guide — Google for Developers](https://developers.google.com/apps-script/guides/properties) — PropertiesService scoping and usage patterns (HIGH confidence — official docs)
- [Class PropertiesService — Google for Developers](https://developers.google.com/apps-script/reference/properties/properties-service) — API reference (HIGH confidence — official docs)
- [Lock Service — Google for Developers](https://developers.google.com/apps-script/reference/lock) — LockService.getScriptLock() for concurrent write guard (HIGH confidence — official docs)
- [Named Range — Google for Developers](https://developers.google.com/apps-script/reference/spreadsheet/named-range) — getRangeByName() for ConfirmationDeadline (HIGH confidence — official docs)
- [Mailto links guide — mailslurp.com](https://www.mailslurp.com/blog/mailto-links-explained/) — URL encoding requirements for mailto body/subject (MEDIUM confidence — community doc, cross-verified with MDN URL encoding spec)
- [mailto character limit — geeklog.adamwilson.info](https://geeklog.adamwilson.info/article/96/There-is-a-maximum-length-on-mailto-links-on-windows) — ~2000-char Windows/Outlook limit (MEDIUM confidence — community report, consistent across multiple sources but not in Microsoft official docs)
- [HTML readonly attribute — MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/readonly) — `disabled` vs `readonly` behavior (HIGH confidence — official spec)
- Existing codebase: `spring-state-cup-nomination.html`, `setup-confirmation-columns.gs`, `verify-sheet-structure.gs` — column indices, CSS variables, and existing patterns verified directly

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Remove SheetJS | HIGH | Verified in existing HTML; rationale is unambiguous |
| doGet response shape | HIGH | Direct extension of established Apps Script doGet pattern |
| PropertiesService for constants | HIGH | Core Apps Script, official docs verified |
| Named range for deadline (Z1) | HIGH | Already implemented in v1.0 Phase 1 scripts |
| mailto encoding + ~2000-char limit | MEDIUM | Encoding: confirmed by multiple sources. Char limit: community-reported, not in official Outlook spec |
| Deadline enforcement (disabled inputs) | HIGH | Standard HTML behavior; server-side check is definitive |
| Token reuse via email scan | HIGH | Standard array scan; established pattern from v1.0 token lookup |
| v2.0 column structure | HIGH | Logical derivation from changed workflow; no external dependency |
| Admin page approach | HIGH | Consistent with PROJECT.md constraint (mailto, Outlook) |

---
*Stack research for: State Cup v2.0 — Referee Detail Collection Workflow*
*Researched: 2026-03-19*
*Supersedes: v1.0 STACK.md sections on MailApp, token generation, doGet/doPost (those remain valid; this document adds v2.0-specific changes)*
