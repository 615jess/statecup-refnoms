# Phase 1: Schema Setup - Research

**Researched:** 2026-03-19
**Domain:** Google Sheets structure, Apps Script data validation, named ranges, column map documentation
**Confidence:** HIGH

## Summary

Phase 1 is a sheet structure rework, not a ground-up build. The v1.0 Phase 1 scripts (`scripts/setup-confirmation-columns.gs`, `scripts/verify-sheet-structure.gs`) already exist and were executed on a test sheet. The v2.0 pivot changes three things from that prior work: (1) status values shrink from 4 to 3 — drop "Pending" and "Declined", keep "Not Sent" and "Confirmed", add "Sent"; (2) column X header changes from "RefHotel" to "LateFlag"; (3) column U header changes from "ConfirmedAt" to "SubmittedAt". Everything else — column positions, Apps Script API patterns, idempotency logic, named range setup, conditional formatting approach — is directly reusable from the v1.0 scripts.

The production sheet may be in one of three states: (a) original 17-column v1.0 nomination state, (b) v1.0 Phase 1 applied with 25 columns using old headers, or (c) unknown manual state. The setup script must handle all three without requiring the user to diagnose the current state first. The CONTEXT.md decision to rebuild the entire header row from a single defined array eliminates the need to branch on sheet state for the header step — just write the full A-Z array unconditionally (except row clearing, which is separate).

The primary Phase 1 deliverable beyond the sheet itself is `.planning/COLUMN-MAP.md`, a machine-readable column index reference that all subsequent phases (2, 3, 4) import as their source of truth for column numbers. This document must exist before planning proceeds on any other phase.

**Primary recommendation:** Write a new `scripts/setup-schema-v2.gs` that rebuilds the full A-Z header row, clears data rows, applies 3-value validation on S, sets up ConfirmationDeadline named range at Z1, and applies v2.0 conditional formatting. Reuse the verification structure from `verify-sheet-structure.gs` adapted for v2.0 headers. Produce `.planning/COLUMN-MAP.md` as a separate deliverable.

## Standard Stack

No new libraries. All operations use Google Apps Script built-ins.

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Apps Script SpreadsheetApp | Built-in | Read/write cells, set validation, manage named ranges, apply conditional formatting | Native API — no external dependencies, runs in Google's infrastructure |
| Apps Script DataValidationBuilder | Built-in | Dropdown validation on column S | Built-in handles UI, rejection, and dropdown arrow rendering |
| Apps Script ConditionalFormatRuleBuilder | Built-in | Color-coded status display | Provides visual feedback to assignor with no external charting tools |

### Supporting Methods
| Method | Purpose |
|--------|---------|
| `sheet.getRange(row, col, numRows, numCols).setValues([[...]])` | Write header row; write/clear data cells |
| `sheet.getRange('A2:Z500').clearContent()` | Clear data rows while preserving header row |
| `sheet.getLastColumn()` | Detect current sheet state before setup |
| `sheet.getLastRow()` | Count data rows for backfill operations |
| `SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build()` | Create dropdown validation rule |
| `range.setDataValidation(rule)` | Apply validation to column S |
| `ss.setNamedRange(name, range)` | Create ConfirmationDeadline named range |
| `ss.getRangeByName(name)` | Check if named range exists (idempotency guard) |
| `SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(val).setBackground(hex).setFontColor(hex).setRanges([range]).build()` | Build one conditional format rule per status value |
| `sheet.setConditionalFormatRules(rules)` | Apply all conditional format rules atomically |
| `sheet.clearConditionalFormatRules()` | Remove existing rules before re-applying (prevents accumulation) |
| `range.getDataValidation().getCriteriaType()` | Verify validation rule in verification script |
| `ss.getRangeByName(name).getA1Notation()` | Verify named range location in verification script |

**No installation required.** All methods are built into Apps Script.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `setAllowInvalid(false)` | `setAllowInvalid(true)` | true = orange triangle warning but value is accepted silently. Success criteria explicitly requires rejection, not warning — must use false. |
| `requireValueInList` | Custom `onEdit` trigger | Trigger approach requires event handler, doesn't show dropdown arrow, has execution quota implications. Built-in validation is correct here. |

**Installation:**
```bash
# No npm install. Copy .gs files into Apps Script editor manually.
```

## Architecture Patterns

### v2.0 Column Map (A-Z, 26 columns)

This is the authoritative column definition for all phases:

| Col | 1-based | 0-based | Header | Writer | Phase |
|-----|---------|---------|--------|--------|-------|
| A | 1 | 0 | Timestamp | System (nominateV2) | Phase 2 |
| B | 2 | 1 | DRA Name | DRA form | Phase 2 |
| C | 3 | 2 | DRA Email | DRA form | Phase 2 |
| D | 4 | 3 | District | DRA form | Phase 2 |
| E | 5 | 4 | Referee # | DRA form | Phase 2 |
| F | 6 | 5 | First Name | DRA form | Phase 2 |
| G | 7 | 6 | Last Name | DRA form | Phase 2 |
| H | 8 | 7 | Referee Email | DRA form | Phase 2 |
| I | 9 | 8 | Phone | Referee form | Phase 3 |
| J | 10 | 9 | Age | Referee form | Phase 3 |
| K | 11 | 10 | Max Age as AR | Referee form | Phase 3 |
| L | 12 | 11 | Max Age as Referee | Referee form | Phase 3 |
| M | 13 | 12 | Availability | Referee form | Phase 3 |
| N | 14 | 13 | Gender | Referee form | Phase 3 |
| O | 15 | 14 | Hotel Weekend 1 | Referee form | Phase 3 |
| P | 16 | 15 | Hotel Weekend 2 | Referee form | Phase 3 |
| Q | 17 | 16 | DRA Notes | DRA form | Phase 2 |
| R | 18 | 17 | Token | System (nominateV2) | Phase 2 |
| S | 19 | 18 | Status | System | Phase 1 (validation) |
| T | 20 | 19 | SentAt | System (Phase 4 TBD) | Phase 4 |
| U | 21 | 20 | SubmittedAt | System (submitDetails) | Phase 3 |
| V | 22 | 21 | RefWeekend1 | Referee form | Phase 3 |
| W | 23 | 22 | RefWeekend2 | Referee form | Phase 3 |
| X | 24 | 23 | LateFlag | System (submitDetails) | Phase 3 |
| Y | 25 | 24 | RefNotes | Referee form | Phase 3 |
| Z | 26 | 25 | (ConfirmationDeadline) | Assignor | Phase 1 (named range) |

**Notes on v1.0 column changes:**
- Col I was `Phone` (same) — now written by referee form, not DRA form
- Col J was `Age` (same) — same
- Cols K-L: `Max Age as AR`, `Max Age as Referee` — same names, now referee-written
- Col M: `Availability` (same name) — now referee-written
- Col N: was `Hotel — Weekend 1` (DRA-written), now `Gender` (referee-written) — **writer AND semantic change**
- Col O: was `Hotel — Weekend 2` (DRA-written), now `Hotel Weekend 1` (referee-written) — position shift
- Col P: was `Day-Specific Notes` (DRA-written), now `Hotel Weekend 2` (referee-written) — position shift
- Col Q: was `DRA Notes` — same name and writer
- Col U: was `ConfirmedAt`, now `SubmittedAt`
- Col X: was `RefHotel`, now `LateFlag` — **renamed for v2.0**

**Warning:** I-P column semantic changes are significant. The v1.0 DRA form wrote hotel/notes data into I-P; v2.0 those same columns are referee detail fields. Since the sheet will be cleared (fresh start), the semantic reuse is safe — no migration needed.

**Open question on I-P headers:** The context input lists I-P as "Referee detail fields" but does not specify exact column-by-column headers for I-N. The Phase 1 CONTEXT.md says the column map is at Claude's discretion for detail level. The table above uses headers inferred from REQUIREMENTS.md (DETAIL-03 lists: weekend 1 availability, weekend 2 availability, hotel need per confirmed weekend, age, gender, phone, day-specific limitations, notes for assignor). The planner should confirm these I-P header names with the REQUIREMENTS before committing them to the column map. This is flagged as a LOW confidence area.

### Recommended Project Structure
```
scripts/
├── setup-schema-v2.gs        # New: rebuild full A-Z headers, validation, named range
└── verify-schema-v2.gs       # New: verification suite for v2.0 schema

.planning/
└── COLUMN-MAP.md             # New: authoritative column reference for all phases
```

The old v1.0 scripts (`setup-confirmation-columns.gs`, `verify-sheet-structure.gs`) are replaced, not updated. Git history preserves them as reference.

### Pattern 1: Rebuild Full Header Row A-Z

Write all 26 headers in a single `setValues` call. This eliminates branching on current sheet state for the header step.

```javascript
// Source: Apps Script Range.setValues API
function _rebuildHeaderRow(sheet) {
  sheet.getRange(1, 1, 1, 26).setValues([[
    'Timestamp',       // A
    'DRA Name',        // B
    'DRA Email',       // C
    'District',        // D
    'Referee #',       // E
    'First Name',      // F
    'Last Name',       // G
    'Referee Email',   // H
    'Phone',           // I
    'Age',             // J
    'Max Age as AR',   // K
    'Max Age as Ref',  // L
    'Availability',    // M
    'Gender',          // N
    'Hotel Weekend 1', // O
    'Hotel Weekend 2', // P
    'DRA Notes',       // Q
    'Token',           // R
    'Status',          // S
    'SentAt',          // T
    'SubmittedAt',     // U
    'RefWeekend1',     // V
    'RefWeekend2',     // W
    'LateFlag',        // X -- was RefHotel in v1.0
    'RefNotes',        // Y
    ''                 // Z -- ConfirmationDeadline (named range, leave header blank)
  ]]);
  Logger.log('Header row rebuilt A-Z.');
}
```

**Note on column Z header:** Z1 is the named range target for ConfirmationDeadline. Keep Z1 blank as the value cell. Write the label "Confirmation Deadline:" in AA1 (same approach as v1.0 confirmed by user).

### Pattern 2: Clear Data Rows (Clean Slate)

Per CONTEXT.md: the sheet is essentially empty. Clear any test/leftover rows, keeping only headers.

```javascript
// Source: Apps Script Sheet.clearContent
function _clearDataRows(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    Logger.log('No data rows to clear.');
    return;
  }
  // Clear A2:Z{lastRow} — clears values but preserves formatting
  sheet.getRange(2, 1, lastRow - 1, 26).clearContent();
  Logger.log('Cleared ' + (lastRow - 1) + ' data rows. Headers preserved in row 1.');
}
```

### Pattern 3: Apply v2.0 Status Validation (3 values)

The critical v2.0 change: exactly 3 values, not 4. "Pending" and "Declined" are gone.

```javascript
// Source: Apps Script DataValidationBuilder API
// https://developers.google.com/apps-script/reference/spreadsheet/data-validation-builder
function _applyStatusValidation(sheet) {
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Not Sent', 'Sent', 'Confirmed'], true)
    .setAllowInvalid(false)
    .build();

  // Apply to S2:S500. Row 1 is the header — excluded intentionally.
  sheet.getRange('S2:S500').setDataValidation(rule);

  Logger.log('Status validation applied: Not Sent / Sent / Confirmed.');
}
```

### Pattern 4: Create ConfirmationDeadline Named Range

Identical to v1.0 pattern — reuse verbatim:

```javascript
// Source: Apps Script Spreadsheet.setNamedRange API
// https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet
function _createDeadlineNamedRange(ss, sheet) {
  var existing = ss.getRangeByName('ConfirmationDeadline');
  if (existing) {
    Logger.log('Named range ConfirmationDeadline already exists at ' +
               existing.getA1Notation() + '. Skipping create.');
  } else {
    ss.setNamedRange('ConfirmationDeadline', sheet.getRange('Z1'));
    Logger.log('Named range ConfirmationDeadline created at Z1.');
  }

  // Write label in AA1 if not already present
  var label = sheet.getRange(1, 27, 1, 1);
  if (label.getValue() === '') {
    label.setValue('Confirmation Deadline:');
  }
}
```

### Pattern 5: v2.0 Conditional Formatting (3 values)

Same pattern as v1.0 but with 3 rules instead of 4 (no Pending/Declined). Clear first to prevent accumulation on re-run:

```javascript
// Source: Apps Script ConditionalFormatRuleBuilder API
function _applyConditionalFormatting(sheet) {
  sheet.clearConditionalFormatRules(); // prevents duplicate rules on re-run
  var range = sheet.getRange('S2:S500');
  var rules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Not Sent')
      .setBackground('#e8eaed').setFontColor('#3c4043')
      .setRanges([range]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Sent')
      .setBackground('#fef9c3').setFontColor('#854d0e')
      .setRanges([range]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Confirmed')
      .setBackground('#dcfce7').setFontColor('#166534')
      .setRanges([range]).build()
  ];
  sheet.setConditionalFormatRules(rules);
  Logger.log('Conditional formatting applied: Not Sent=gray, Sent=yellow, Confirmed=green.');
}
```

### Pattern 6: Idempotent Main Orchestrator

The CONTEXT.md leaves idempotency approach to Claude's discretion. Given the clean-slate decision (clear data rows), idempotency simplifies: run the full setup regardless of current state. The only guards needed are for the named range (cannot create duplicates) and for the header write (safe to overwrite).

```javascript
function setupSchemaV2() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();

  Logger.log('=== setupSchemaV2 START ===');
  Logger.log('Sheet: ' + sheet.getName() + ' | Cols: ' + sheet.getLastColumn());

  _rebuildHeaderRow(sheet);        // Step 1: full A-Z header row
  _clearDataRows(sheet);           // Step 2: clean slate
  _applyStatusValidation(sheet);   // Step 3: S2:S500 dropdown (3 values)
  _createDeadlineNamedRange(ss, sheet); // Step 4: ConfirmationDeadline at Z1
  _applyConditionalFormatting(sheet);  // Step 5: color-code column S

  Logger.log('=== setupSchemaV2 COMPLETE ===');
  Logger.log('ACTION: Enter the confirmation deadline date in cell Z1.');
}
```

### Anti-Patterns to Avoid

- **Never use `insertColumns` or `insertColumnBefore`** — shifts all subsequent column indices. Phase 2+ code uses fixed 1-based column numbers. An insertion would silently corrupt every subsequent phase's writes.
- **Never run `appendRow` to write headers** — appends at the bottom as a data row, not at row 1.
- **Never apply validation to S1:S500** — this locks the header cell to dropdown values and the word "Status" cannot be typed. Always start from S2.
- **Never call `setNamedRange` twice** — creates a duplicate named range that does not overwrite the first. Always check `getRangeByName` first.
- **Never use `let`, `const`, arrow functions, or template literals** — Google Apps Script runs ES5. These will throw a parse error at execution time, not at paste time.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dropdown with rejection | Custom `onEdit` trigger | `requireValueInList` + `setAllowInvalid(false)` | Built-in validation handles UI, rejection, dropdown arrow — onEdit fires after entry, cannot prevent invalid value from landing in cell |
| Named cell reference | Hard-coded `'Z1'` string throughout codebase | `ss.setNamedRange` + `ss.getRangeByName('ConfirmationDeadline')` | Named range survives row/column insertions; hard-coded cell address is fragile |
| Counting last row | Manual loop over values | `sheet.getLastRow()` | Built-in returns correct result including merged cells and filters |
| Clearing old validation | Manual inspection and removal | `sheet.getRange('S2:S500').clearDataValidations()` before `setDataValidation` | Explicit clear before set prevents accumulation of stale v1.0 rules |

**Key insight:** The v1.0 scripts have a subtle gap: `_applyStatusValidation` calls `setDataValidation` without clearing first. If the v1.0 rules are already on the sheet, calling `setDataValidation` on the same range replaces them. However, if the rule was applied to a different range (e.g., `S2:S1000` in some manual edit), the old rule may persist alongside the new one. A safe v2.0 practice is to call `clearDataValidations()` on the entire S column before applying the new rule.

## Common Pitfalls

### Pitfall 1: v1.0 Validation Values Silently Persisting

**What goes wrong:** The v1.0 scripts wrote a 4-value validation (Not Sent / Pending / Confirmed / Declined). If those rules are present on the sheet and the v2.0 script applies a new 3-value rule to `S2:S500`, but the v1.0 rule was set on a slightly different range (e.g., with a different `getRange` call), both rules may coexist. The sheet may accept "Pending" in cells outside the v2.0 range with no visible error.

**Why it happens:** `setDataValidation` on a range replaces the rule for exactly that range, but doesn't remove rules from overlapping or adjacent ranges that were set separately.

**How to avoid:** Before applying the v2.0 validation, call `sheet.getRange('S:S').clearDataValidations()` to clear the entire column S, then apply the new rule to `S2:S500`.

**Warning signs:** After setup, click a cell in S3. If the dropdown shows 4 options instead of 3, old rules are present.

### Pitfall 2: "Pending" in Conditional Formatting Persists

**What goes wrong:** `clearConditionalFormatRules()` clears sheet-wide. This is correct for our sheet (we own all formatting). However, if the user has manually added conditional formatting elsewhere on the sheet (e.g., color rows by district), that will be wiped.

**Why it happens:** Apps Script's `clearConditionalFormatRules()` is sheet-wide, not range-scoped.

**How to avoid:** Document this in the script header comment. Since the CONTEXT.md says the sheet is essentially empty and a fresh start, this is acceptable. If the user has custom formatting, they'll need to re-apply it after running setup.

**Warning signs:** Any non-status conditional formatting the assignor added manually will be gone after setup.

### Pitfall 3: Column X Header Named "LateFlag" — Verification Must Match

**What goes wrong:** The v1.0 verification script checks for header `'RefHotel'` at column X (1-based 24). The v2.0 verification must check for `'LateFlag'`. If the old verification script is reused without updating the expected header list, it will report a false FAIL.

**Why it happens:** Copy-paste from v1.0 verify script without updating expected headers array.

**How to avoid:** The verification script's expected header array must exactly match the v2.0 column map. Define the expected headers as a constant at the top of the verification script, not inline.

### Pitfall 4: Off-by-One on 1-based vs 0-based Column Numbers

**What goes wrong:** `getRange(row, column)` uses 1-based column numbers. Column S = 19 (1-based). Column S = 18 (0-based array index). Confusing these writes or reads to the wrong column.

**Why it happens:** JavaScript array indexing is 0-based; Apps Script `getRange` is 1-based. Switching contexts causes off-by-one errors.

**How to avoid:** Define named constants at the top of every script:
```javascript
var COL_TOKEN        = 18; // R — 1-based
var COL_STATUS       = 19; // S — 1-based
var COL_SENT_AT      = 20; // T — 1-based
var COL_SUBMITTED_AT = 21; // U — 1-based
var COL_REF_WEEKEND1 = 22; // V — 1-based
var COL_REF_WEEKEND2 = 23; // W — 1-based
var COL_LATE_FLAG    = 24; // X — 1-based
var COL_REF_NOTES    = 25; // Y — 1-based
var COL_DEADLINE     = 26; // Z — 1-based (named range target)
```
Use these constants everywhere. Never use bare number literals for column references.

### Pitfall 5: ES5 Syntax Violation

**What goes wrong:** Using `const`, `let`, arrow functions (`=>`), or template literals (backticks) in Apps Script causes a parse error that prevents the script from running at all. The error message in the execution log may not clearly identify which line is causing the problem.

**Why it happens:** Modern JavaScript habits. Apps Script's V8 runtime actually supports ES6+, but the **safest practice for a one-time setup script** is to use `var` throughout, consistent with the v1.0 patterns and the verified working scripts.

**How to avoid:** Use `var` for all declarations. Use string concatenation instead of template literals. Use named functions instead of arrow functions. This matches the v1.0 verified working pattern.

**Note:** Google Apps Script's V8 runtime (enabled since 2020) does support ES6+. Using `const`/`let` and arrow functions will work. However, the v1.0 scripts used ES5 and the plan calls for reusing those patterns. Consistency with the existing codebase is more important than ES6 modernization in a one-time setup script.

### Pitfall 6: Named Range Persists Across Sheet Clears

**What goes wrong:** If the user copies the production sheet to create a test sheet, the named range `ConfirmationDeadline` is copied with it. Running the setup script on the test sheet skips named range creation (because it already exists). This is correct behavior — but if the user then deletes the named range manually and reruns, the script recreates it correctly.

**Why it happens:** Named ranges travel with the spreadsheet on copy.

**How to avoid:** No action needed — this is correct behavior. Document in the script that named ranges persist across copies.

## Code Examples

### Read ConfirmationDeadline in Later Phases

All subsequent phases read the deadline like this:

```javascript
// Source: Apps Script Spreadsheet.getRangeByName API
var ss = SpreadsheetApp.getActiveSpreadsheet();
var deadlineRange = ss.getRangeByName('ConfirmationDeadline');
if (!deadlineRange) {
  throw new Error('ConfirmationDeadline named range not found. Run Phase 1 setup.');
}
var deadline = deadlineRange.getValue(); // returns a Date object if Z1 has a date
```

### Verification: Check v2.0 Status Validation Criteria

```javascript
// Source: Apps Script DataValidation.getCriteriaValues API
function verifyStatusValidation(sheet) {
  var cell = sheet.getRange('S2');
  var rule = cell.getDataValidation();
  if (!rule) {
    Logger.log('FAIL — No validation on S2');
    return false;
  }
  var type = rule.getCriteriaType();
  var values = rule.getCriteriaValues();
  if (type !== SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
    Logger.log('FAIL — Wrong criteria type: ' + type);
    return false;
  }
  var list = values[0]; // first criteria value is the allowed-list array
  var expected = ['Not Sent', 'Sent', 'Confirmed'];
  if (JSON.stringify(list) !== JSON.stringify(expected)) {
    Logger.log('FAIL — Wrong values: ' + list.join(', '));
    return false;
  }
  Logger.log('PASS — Column S validation: Not Sent / Sent / Confirmed');
  return true;
}
```

### Verification: Check v2.0 Headers A-Z

```javascript
// Source: Apps Script Range.getValues API
var EXPECTED_HEADERS = [
  'Timestamp', 'DRA Name', 'DRA Email', 'District', 'Referee #',   // A-E
  'First Name', 'Last Name', 'Referee Email',                       // F-H
  'Phone', 'Age', 'Max Age as AR', 'Max Age as Ref',                // I-L
  'Availability', 'Gender', 'Hotel Weekend 1', 'Hotel Weekend 2',   // M-P
  'DRA Notes',                                                       // Q
  'Token', 'Status', 'SentAt', 'SubmittedAt',                       // R-U
  'RefWeekend1', 'RefWeekend2', 'LateFlag', 'RefNotes',             // V-Y
  ''                                                                  // Z (blank — named range cell)
];

function verifyHeaders(sheet) {
  var actual = sheet.getRange(1, 1, 1, 26).getValues()[0];
  var mismatches = [];
  for (var i = 0; i < EXPECTED_HEADERS.length; i++) {
    if (actual[i] !== EXPECTED_HEADERS[i]) {
      var col = String.fromCharCode(65 + i);
      mismatches.push('Col ' + col + ': expected "' + EXPECTED_HEADERS[i] +
                      '", got "' + actual[i] + '"');
    }
  }
  if (mismatches.length === 0) {
    Logger.log('PASS — All headers A-Z match expected values');
    return true;
  }
  Logger.log('FAIL — Header mismatches: ' + mismatches.join('; '));
  return false;
}
```

## State of the Art

| Old (v1.0) Approach | New (v2.0) Approach | Impact |
|---------------------|---------------------|--------|
| 4 status values: Not Sent / Pending / Confirmed / Declined | 3 status values: Not Sent / Sent / Confirmed | Validation rule must be replaced entirely; any v1.0 Pending/Declined values in sheet would not match v2.0 validation (handled by clearing data rows) |
| Column X = RefHotel (DRA-provided) | Column X = LateFlag (system-written on late submission) | Header must be renamed; verification expected-headers array must be updated |
| Column U = ConfirmedAt | Column U = SubmittedAt | Header rename only; same position |
| Columns I-P = DRA-provided details (phone, age, hotel, notes) | Columns I-P = Referee-provided details (phone, age, gender, hotel, limitations) | Writer changes, positions stay; semantic change covered by clear-and-rebuild |
| Surgical column updates (add R-Y to existing A-Q) | Full header row rebuild from A-Z array | Simpler, more robust — eliminates column-count branching logic |
| Backfill Status for existing rows | Clear data rows entirely (fresh start) | Eliminates backfill logic; setup is simpler |
| v1.0 doPost writes 17 values (A-Q) — preserve compatibility | Remove v1.0 doPost entirely — v2.0 nominateV2 replaces it | No backward compat concern; Phase 2 builds nominateV2 fresh |

## Open Questions

1. **Exact headers for columns I-N**
   - What we know: REQUIREMENTS DETAIL-03 lists "age, gender, phone, day-specific limitations, and notes for assignor" as referee-collected fields. The context input column map shows I-P as "Referee detail fields" without per-column names.
   - What's unclear: Exact column assignments for I-N (which position maps to which field). The research table above (Phone=I, Age=J, Max Age as AR=K, Max Age as Ref=L, Availability=M, Gender=N, Hotel Weekend 1=O, Hotel Weekend 2=P) is inferred from the REQUIREMENTS and v1.0 patterns but not explicitly stated in any decision document.
   - Recommendation: The planner should explicitly define all I-P header names in the plan. The column map is the Phase 1 deliverable that locks these — Phase 2 and 3 cannot start without them. If Phase 2 requirements define the DRA form fields (A-H, Q), the I-P fields are by elimination what the referee form writes.
   - Confidence: LOW — derived from REQUIREMENTS inference, not explicit decision

2. **Whether to write a dev/test sheet alongside production**
   - What we know: CONTEXT.md leaves this to Claude's discretion; v1.0 approach was to verify on a test copy first
   - What's unclear: Whether the assignor wants this discipline in v2.0 given the clean-slate approach makes the setup lower-risk
   - Recommendation: Recommend verifying on a test copy first (same approach as v1.0) — the setup script is idempotent and fast to run, so the test copy provides safety with minimal friction
   - Confidence: HIGH — same practice as v1.0, confirmed working

3. **What v1.0 Apps Script code to remove**
   - What we know: The v1.0 doPost handler (17-value appendRow) lives in the Apps Script project attached to the production sheet, not in any file in this repo. The SETUP-INSTRUCTIONS.txt contains it as a code block.
   - What's unclear: Whether the production Apps Script project still has the v1.0 doPost verbatim or if it has been modified. The plan should instruct the user to delete the existing Apps Script code before Phase 2 writes the new nominateV2 handler.
   - Recommendation: Phase 1 plan should include a task to clear the Apps Script editor (delete all existing code). This is a user-action step, not an automated step. Document it as a setup prerequisite in the plan.
   - Confidence: MEDIUM

## Sources

### Primary (HIGH confidence)
- `scripts/setup-confirmation-columns.gs` — v1.0 working patterns for header-write, backfill, validation, named range, conditional formatting; ES5 idioms confirmed
- `scripts/verify-sheet-structure.gs` — v1.0 verification patterns for PASS/FAIL structure, `getCriteriaType`, `getCriteriaValues`, `getA1Notation`
- `SETUP-INSTRUCTIONS.txt` — authoritative v1.0 column map (A-Q, 17 columns); live doPost code
- `.planning/phases/01-sheet-schema/01-01-SUMMARY.md` — confirmed what was actually applied and user-verified on v1.0 test sheet
- [DataValidationBuilder API](https://developers.google.com/apps-script/reference/spreadsheet/data-validation-builder) — `requireValueInList`, `setAllowInvalid`, `build` (fetched in v1.0 research 2026-03-18, docs updated 2025-12-11)
- [Spreadsheet API](https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet) — `setNamedRange`, `getRangeByName` (same source)
- `.planning/REQUIREMENTS.md` — v2.0 SCHEMA and DETAIL requirements confirming 3 status values, LateFlag column, deadline named range

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — v2.0 column index constants table (R=18 through Z=26); flagged as "verify in Phase 1"
- `.planning/ROADMAP.md` — Phase 1 success criteria (6 items); plan 01-01 description confirms schema tasks

### Tertiary (LOW confidence)
- Inferred I-P header assignments from REQUIREMENTS.md DETAIL-03 + v1.0 column patterns — not explicitly defined in any decision document

## Metadata

**Confidence breakdown:**
- Standard stack (Apps Script APIs): HIGH — confirmed from working v1.0 scripts and official docs
- Column map A-H, Q-Z: HIGH — explicitly defined in context input and REQUIREMENTS
- Column map I-P: LOW — inferred from REQUIREMENTS, not explicitly decided
- Architecture patterns (header rebuild, clear, validation, named range): HIGH — direct reuse of v1.0 working patterns with targeted changes
- v2.0 differences from v1.0: HIGH — explicitly stated in CONTEXT.md decisions

**Research date:** 2026-03-19
**Valid until:** 2026-09-19 (Apps Script APIs are stable; sheet structure is frozen by this phase)
