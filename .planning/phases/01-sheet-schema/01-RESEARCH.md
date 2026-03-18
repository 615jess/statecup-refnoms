# Phase 1: Sheet Schema - Research

**Researched:** 2026-03-18
**Domain:** Google Sheets structure, Apps Script data validation, named ranges
**Confidence:** HIGH

## Summary

Phase 1 is a sheet structure operation: append eight new columns (R-Y) to the existing
Google Sheet, backfill column S with "Not Sent" for all existing rows, add a dropdown
data validation on column S, and create a named range for the confirmation deadline.
No Apps Script code changes. No HTML changes. No new deployment.

The existing `doPost` in the Apps Script writes exactly 17 values to a new row via
`appendRow([...17 values...])`. When the sheet gains columns R-Y (making 25 total),
`appendRow` with a 17-element array writes only to columns A-Q and leaves R-Y empty in
the new row. This is standard Google Sheets behavior — rows are sparse and cells beyond
the array length are simply not written. This is the primary safety property that makes
the phase low-risk.

The column map is authoritative and confirmed from both SETUP-INSTRUCTIONS.txt and
the live `doPost` code. The sheet currently has exactly 17 columns, A through Q.

**Primary recommendation:** Add headers manually (or via a one-time setup script) and
backfill column S with "Not Sent" via `getRange` + `setValues`. Apply dropdown data
validation on column S using `SpreadsheetApp.newDataValidation()`. Create a named range
for the deadline cell using `ss.setNamedRange('ConfirmationDeadline', range)`. Defer
token pre-generation (column R) to Phase 2.

## Standard Stack

No new libraries. This phase uses Google Apps Script built-ins only.

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Google Sheets UI | Current | Add column headers, column widths, conditional formatting | Manual changes with zero deployment risk |
| Apps Script SpreadsheetApp | Built-in | Backfill values, set data validation, create named range | Native API — no external dependencies |

### Supporting
| Method | Where Used | Purpose |
|--------|-----------|---------|
| `sheet.getDataRange().getValues()` | Backfill script | Read all existing rows to count them |
| `sheet.getRange(row, col, numRows, numCols)` | Backfill script | Target column S for batch write |
| `range.setValues([[...]])` | Backfill script | Write "Not Sent" to all existing data rows |
| `SpreadsheetApp.newDataValidation()` | Validation script | Create the dropdown rule builder |
| `.requireValueInList(values, true)` | Validation script | Restrict column S to four status values |
| `.setAllowInvalid(false)` | Validation script | Reject values outside the allowed list |
| `ss.setNamedRange(name, range)` | Setup script | Create named deadline cell |
| `ss.getRangeByName(name)` | Phase 2+ | Read deadline from Apps Script code |

**No installation required.** All methods are built into Apps Script.

## Architecture Patterns

### Confirmed Column Map (A-Q, 17 columns)

Authoritative source: `SETUP-INSTRUCTIONS.txt` and live `doPost` code in `spring-state-cup-nomination.html`.

| Col | Index (0-based) | Header | Written by doPost |
|-----|-----------------|--------|-------------------|
| A | 0 | Timestamp | `r.timestamp` |
| B | 1 | DRA Name | `r.dra` |
| C | 2 | DRA Email | `r.email` |
| D | 3 | District | `r.district` |
| E | 4 | Referee # | `r.ref_num` |
| F | 5 | First Name | `r.first` |
| G | 6 | Last Name | `r.last` |
| H | 7 | Referee Email | `r.ref_email` |
| I | 8 | Phone | `r.phone` |
| J | 9 | Age | `r.age` |
| K | 10 | Max Age as AR | `r.max_ar` |
| L | 11 | Max Age as Referee | `r.max_ref` |
| M | 12 | Availability | `r.availability` |
| N | 13 | Hotel — Weekend 1 | `r.hotel_wk1` |
| O | 14 | Hotel — Weekend 2 | `r.hotel_wk2` |
| P | 15 | Day-Specific Notes | `r.day_notes` |
| Q | 16 | DRA Notes | `r.notes` |

**Verification step (mandatory):** Before making any changes, run a script-based column
count check confirming the sheet has exactly 17 columns, and that column Q (index 16) is
the last data column.

### New Columns to Add (R-Y, 8 columns)

These are appended only — never inserted. Inserting would shift existing column indices
and break `doPost`.

| Col | Index (0-based) | Header | Default Value | Notes |
|-----|-----------------|--------|---------------|-------|
| R | 17 | Token | (blank) | Generated in Phase 2 |
| S | 18 | Status | Not Sent | Backfill all existing rows |
| T | 19 | SentAt | (blank) | Written in Phase 4 |
| U | 20 | ConfirmedAt | (blank) | Written in Phase 2 backend |
| V | 21 | RefWeekend1 | (blank) | Written on confirmation submit |
| W | 22 | RefWeekend2 | (blank) | Written on confirmation submit |
| X | 23 | RefHotel | (blank) | Written on confirmation submit |
| Y | 24 | RefNotes | (blank) | Written on confirmation submit |

### Recommended Project Structure

No new files are created in this phase. All operations target the existing Google Sheet.
The setup script (if used) runs once from the Apps Script editor and can be discarded.

### Pattern 1: Backfill Column S with "Not Sent"

Read existing data to determine row count, then write "Not Sent" to column S for all
data rows (rows 2 through lastRow, skipping header row 1).

```javascript
// Source: Apps Script SpreadsheetApp API
function backfillStatusColumn() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();

  // Verify column count before proceeding
  var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (headerRow.length !== 17) {
    throw new Error('Expected 17 columns (A-Q), found ' + headerRow.length + '. Aborting.');
  }

  var lastRow = sheet.getLastRow();  // includes header row
  var dataRowCount = lastRow - 1;   // subtract header

  if (dataRowCount < 1) {
    Logger.log('No data rows found. Nothing to backfill.');
    return;
  }

  // Column S = column index 19 (1-based)
  var statusCol = 19;
  var statusRange = sheet.getRange(2, statusCol, dataRowCount, 1);

  // Build 2D array: [[Not Sent], [Not Sent], ...]
  var values = [];
  for (var i = 0; i < dataRowCount; i++) {
    values.push(['Not Sent']);
  }

  statusRange.setValues(values);
  Logger.log('Backfilled ' + dataRowCount + ' rows with "Not Sent".');
}
```

### Pattern 2: Apply Dropdown Data Validation on Column S

Run after adding column S header. Applies validation to the entire column S data range
(rows 2 onward, using a generous upper bound to cover future nominations).

```javascript
// Source: Apps Script DataValidationBuilder API
// https://developers.google.com/apps-script/reference/spreadsheet/data-validation-builder
function applyStatusValidation() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();

  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Not Sent', 'Pending', 'Confirmed', 'Declined'], true)
    .setAllowInvalid(false)
    .build();

  // Apply to column S, rows 2-500 (covers any realistic nomination count)
  var statusRange = sheet.getRange('S2:S500');
  statusRange.setDataValidation(rule);

  Logger.log('Data validation applied to S2:S500.');
}
```

`requireValueInList(values, true)` — the second argument `true` shows the dropdown arrow
in the cell. `setAllowInvalid(false)` rejects values not in the list.

### Pattern 3: Create Named Range for Confirmation Deadline

Store the deadline in a visible, labeled cell. The named range allows Apps Script code
in Phase 2+ to read it without hard-coding a cell address.

```javascript
// Source: Apps Script Spreadsheet.setNamedRange API
// https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet
function createDeadlineNamedRange() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();

  // Place deadline in a visible location — e.g., row 1 area or a dedicated info area
  // Recommendation: use a cell clearly labeled for the assignor, e.g., B1 on a
  // "Settings" row, or a dedicated cell in an unused column of row 1 with a label.
  // For this project: place in cell Z1 (off to the right, clearly separate from data)
  // with a label in Y1 reading "Confirmation Deadline:".
  var deadlineCell = sheet.getRange('Z1');
  ss.setNamedRange('ConfirmationDeadline', deadlineCell);

  Logger.log('Named range ConfirmationDeadline set at Z1.');
}
```

To read the deadline in Phase 2+ Apps Script code:
```javascript
var deadline = ss.getRangeByName('ConfirmationDeadline').getValue();
```

### Anti-Patterns to Avoid

- **Never insert columns** (Insert > Columns left/right in the Sheets UI). Inserting
  shifts all column indices right of the insertion point. The existing `doPost` uses
  positional `appendRow([17 values])` — if column N shifts to column O, hotel data
  writes to the wrong column. Always append to the right end only.
- **Never run a script that calls `sheet.insertColumns()` or `sheet.insertColumnBefore()`**
  on the existing data range. The same index-shifting problem applies.
- **Do not add headers by running `appendRow`** — appending a header row would add it
  as a data row at the bottom, not at row 1. Add headers by selecting the cell in the
  Sheets UI and typing, or by using `sheet.getRange('R1:Y1').setValues([...])` which
  targets the exact header row.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dropdown validation | Custom onEdit trigger checking cell value | `SpreadsheetApp.newDataValidation().requireValueInList()` | Built-in validation handles UI, rejection, and dropdown rendering automatically |
| Named cell for deadline | A convention like "always use cell Z1" undocumented | `ss.setNamedRange('ConfirmationDeadline', range)` | Named ranges are robust to row/column movement and self-documenting |
| Counting existing rows | Iterating sheet values to find last non-empty row | `sheet.getLastRow()` | Built-in method returns the last row with content; no manual iteration |

**Key insight:** The entire phase can be done manually in the Sheets UI (typing headers,
typing "Not Sent" in existing rows, adding a dropdown via Data > Data validation). A
script is useful for the backfill when there are many rows, but manual entry is valid
for fewer than ~20 rows.

## Common Pitfalls

### Pitfall 1: Inserting Instead of Appending Columns

**What goes wrong:** Developer uses Insert > Column in the Sheets UI to add the new
columns between existing columns, or inserts at column Q instead of appending after it.
This shifts existing column indices. The `doPost` `appendRow` writes to positional
indices — column N (0-based index 13) is hotel_wk1. If column N shifts to column O,
all hotel data writes to the wrong column from that point forward.

**Why it happens:** The Sheets UI defaults to "insert left" when right-clicking a
column header.

**How to avoid:** Always add new columns by clicking on an empty column header to the
right of the last column (column R), typing the header, and moving right. Or use a
setup script that calls `sheet.getRange('R1').setValue('Token')` etc. — `getRange` on
a specific cell address cannot accidentally insert.

**Warning signs:** After adding new columns, open the Apps Script and check that
`appendRow([...17 values...])` in `doPost` still maps correctly — submit a test
nomination and verify column Q (DRA Notes) receives the value, not column X.

### Pitfall 2: Backfilling Status Overwrites Column R (Token)

**What goes wrong:** Script targets column 18 (1-based) intending to write Status, but
uses 0-based index 18 (column S) or 1-based index 18 (column R) incorrectly.

**Why it happens:** Off-by-one between 0-based array indexing and 1-based `getRange`
column parameter.

**How to avoid:** In Apps Script, `getRange(row, column)` uses 1-based column numbers.
Column R = 18, Column S = 19. Always verify: `sheet.getRange(1, 19, 1, 1).getValue()`
should return "Status" after adding the header.

**Warning signs:** Token column unexpectedly filled with "Not Sent" strings.

### Pitfall 3: Setting Validation Before Headers Exist

**What goes wrong:** Running the validation script before column S has its "Status"
header. The validation still applies, but the header cell itself gets restricted to the
dropdown values and the assignor cannot type "Status" as a header.

**Why it happens:** Setup script runs in wrong order.

**How to avoid:** Add all 8 headers (R1:Y1) first, then run the validation script.
Apply validation only to S2:S500 (not S1:S500).

### Pitfall 4: Named Range Conflicts

**What goes wrong:** `setNamedRange('ConfirmationDeadline', range)` called twice
creates a duplicate named range, not an update.

**Why it happens:** Setup script run more than once.

**How to avoid:** Check for existing named range before creating:
```javascript
var existing = ss.getRangeByName('ConfirmationDeadline');
if (existing) {
  Logger.log('Named range already exists at: ' + existing.getA1Notation());
} else {
  ss.setNamedRange('ConfirmationDeadline', deadlineCell);
}
```

### Pitfall 5: appendRow Behavior With Filters Active

**What goes wrong:** If a column filter is currently active on the sheet when `doPost`
calls `appendRow`, the new row may be appended to the wrong position or not appear in
the filtered view.

**Why it happens:** Google Sheets' `appendRow` appends to the "last row of the data
region" which interacts oddly with filtered views.

**How to avoid:** Confirm with the assignor that no persistent filters are saved on the
sheet. For testing, remove any active filters before submitting test nominations.

## Code Examples

### Verification Script (Run Before Making Any Changes)

```javascript
// Source: Apps Script SpreadsheetApp API
function verifySheetStructure() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  Logger.log('Column count: ' + headers.length);
  Logger.log('Headers: ' + headers.join(', '));
  Logger.log('Last column letter: ' + String.fromCharCode(64 + headers.length));

  // Expected: 17 columns, last = Q
  if (headers.length !== 17) {
    Logger.log('WARNING: Expected 17 columns, found ' + headers.length);
  } else {
    Logger.log('OK: Column count matches expected (A-Q = 17)');
  }

  // Check specific expected headers
  var expected = {
    0: 'Timestamp', 5: 'First Name', 6: 'Last Name',
    7: 'Referee Email', 12: 'Availability', 15: 'Day-Specific Notes', 16: 'DRA Notes'
  };
  Object.keys(expected).forEach(function(i) {
    var actual = headers[parseInt(i)];
    if (actual !== expected[i]) {
      Logger.log('MISMATCH col ' + (parseInt(i)+1) + ': expected "' + expected[i] + '", got "' + actual + '"');
    }
  });
}
```

### Add Column R-Y Headers (One-Time Setup)

```javascript
// Source: Apps Script Range.setValues API
function addConfirmationHeaders() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  // Verify we're at column 17 before appending
  if (sheet.getLastColumn() !== 17) {
    throw new Error('Expected 17 columns before adding headers. Found: ' + sheet.getLastColumn());
  }

  // Set headers in R1:Y1 (columns 18-25, 1-based)
  sheet.getRange(1, 18, 1, 8).setValues([[
    'Token', 'Status', 'SentAt', 'ConfirmedAt',
    'RefWeekend1', 'RefWeekend2', 'RefHotel', 'RefNotes'
  ]]);

  Logger.log('Headers added: R1=Token through Y1=RefNotes');
}
```

### Test Nomination Submission Verification

After adding columns, verify that a test submission still writes to A-Q only:

```javascript
// Source: Apps Script SpreadsheetApp API
function verifyTestSubmission() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();

  // Read the last data row (assumed to be a test submission)
  var rowData = sheet.getRange(lastRow, 1, 1, 25).getValues()[0];

  Logger.log('Columns A-Q (should have data):');
  for (var i = 0; i < 17; i++) {
    Logger.log('  Col ' + String.fromCharCode(65+i) + ': ' + rowData[i]);
  }

  Logger.log('Columns R-Y (should all be empty):');
  var allEmpty = true;
  for (var j = 17; j < 25; j++) {
    if (rowData[j] !== '' && rowData[j] !== null) {
      Logger.log('  WARNING Col ' + String.fromCharCode(65+j) + ': ' + rowData[j]);
      allEmpty = false;
    }
  }
  if (allEmpty) Logger.log('OK: Columns R-Y are all empty as expected');
}
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Manual cell-by-cell backfill | `getRange().setValues()` batch write | Faster for >10 rows; same result |
| Hard-coded cell address for deadline | `setNamedRange()` + `getRangeByName()` | Named range survives column/row insertions elsewhere in sheet |

**No deprecated approaches** in this phase. All methods used are current Apps Script
standard practice.

## Open Questions

1. **Exact placement of ConfirmationDeadline named range**
   - What we know: Named range can point to any cell; Z1 is suggested as it's outside
     the data columns (A-Y) and visible to the assignor
   - What's unclear: Does the assignor prefer it in a separate "Settings" tab, or inline
     in the main sheet? A separate tab is cleaner but adds a tab-navigation step.
   - Recommendation: Default to Z1 on the main sheet (visible alongside nominations);
     plan step should note this is adjustable before commit.

2. **Whether to pre-generate tokens in column R during backfill**
   - What we know: CONTEXT.md leaves this to Claude's discretion; Phase 4 (email admin)
     is when tokens are consumed
   - What's unclear: Pre-generating now simplifies Phase 2 testing (can test doGet with
     a real token immediately) but adds UUID generation logic to this phase
   - Recommendation: Defer token pre-generation to Phase 2. Phase 1 success criteria
     only require column S to be backfilled and column R to exist with the correct header.
     Column R can remain blank. This keeps Phase 1 scope clean.

3. **Conditional formatting for Status column**
   - What we know: CONTEXT.md leaves formatting to Claude's discretion
   - What's unclear: Color-coding status values (Not Sent=gray, Pending=yellow,
     Confirmed=green, Declined=red) would help the assignor at a glance; complexity is low
   - Recommendation: Add conditional formatting via Apps Script in the same setup script.
     It is a one-time enhancement that costs ~10 lines of code and provides visible value.

## Sources

### Primary (HIGH confidence)
- `SETUP-INSTRUCTIONS.txt` — authoritative column map (A-Q, 17 columns), live doPost code
- `spring-state-cup-nomination.html` — confirms exact `appendRow` array (17 values) and
  `SHEET_URL` constant
- [Class DataValidationBuilder | Apps Script](https://developers.google.com/apps-script/reference/spreadsheet/data-validation-builder) — `requireValueInList`, `setAllowInvalid`, `build` signatures
- [Class Spreadsheet | Apps Script](https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet) — `setNamedRange`, `getRangeByName` signatures
- [Class Range | Apps Script](https://developers.google.com/apps-script/reference/spreadsheet/range) — `setValues`, `setValue`, `setDataValidation` signatures
- `.planning/research/ARCHITECTURE.md` — prior milestone research confirming column indices, `appendRow` isolation, and Apps Script patterns

### Secondary (MEDIUM confidence)
- [Class Sheet | Apps Script | Google for Developers](https://developers.google.com/apps-script/reference/spreadsheet/sheet) — `getLastRow`, `getLastColumn`, `appendRow` descriptions (official docs, partial content retrieved)

### Tertiary (LOW confidence)
- WebSearch results on `appendRow` behavior with fewer values than columns — the behavior
  (extra columns remain empty) is well-established Google Sheets semantics, confirmed
  across multiple community sources and consistent with the Sheets data model, but no
  single official doc was found that states it explicitly.

## Metadata

**Confidence breakdown:**
- Column map (A-Q): HIGH — read directly from live source code in SETUP-INSTRUCTIONS.txt and nomination HTML
- appendRow isolation (R-Y stay blank): HIGH — verified via source code review (17-element array); behavior consistent with Sheets data model
- Data validation API: HIGH — fetched from official Google developer docs (updated 2025-12-11)
- Named range API: HIGH — fetched from official Google developer docs (updated 2025-12-11)
- backfill via setValues pattern: HIGH — standard Apps Script Range API, confirmed from official docs

**Research date:** 2026-03-18
**Valid until:** 2026-09-18 (stable platform — Apps Script APIs change infrequently)
