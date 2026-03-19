/**
 * setup-schema-v2.gs
 *
 * CLEAN-SLATE SETUP SCRIPT — State Cup Referee Nomination System v2.0
 * Phase 1: Schema Setup
 *
 * WHAT THIS SCRIPT DOES (in order):
 *   1. Rebuilds the full header row A-Z (26 columns) from a single locked array
 *   2. Clears all data rows A2:Z{lastRow} — fresh start, no migration
 *   3. Clears any old validation on column S, then applies v2.0 3-value dropdown
 *      (Not Sent / Sent / Confirmed) with rejection of invalid values
 *   4. Creates ConfirmationDeadline named range at Z1 (idempotent)
 *   5. Clears old conditional formatting, then applies 3-rule v2.0 color coding
 *
 * HOW TO RUN:
 *   1. Open your Google Sheet (production OR a test copy — recommend test copy first)
 *   2. Go to Extensions > Apps Script
 *   3. Delete ALL existing code in the editor (clean slate for v2.0)
 *   4. Create a new script file, paste the full contents of this file
 *   5. Select "setupSchemaV2" from the function dropdown
 *   6. Click Run (play button)
 *   7. Authorize when prompted
 *   8. Check the Execution Log — you should see step-by-step logs ending with
 *      "setupSchemaV2 COMPLETE"
 *   9. Return to the sheet and verify row 1 has all headers A-Y
 *  10. Enter the actual tournament confirmation deadline date in cell Z1
 *
 * IDEMPOTENT:
 *   Safe to run more than once. Header row is always overwritten. Data rows
 *   are cleared on every run. Validation clears then re-applies. Named range
 *   checks for existence before creating. Conditional formatting clears then
 *   re-applies.
 *
 *   WARNING: clearConditionalFormatRules() is sheet-wide. Any custom conditional
 *   formatting you added manually will be removed. Re-apply after running setup.
 *
 * NAMED RANGES:
 *   Named ranges persist if you copy the spreadsheet to create a test copy.
 *   The idempotency guard handles this correctly — it will log "already exists"
 *   and skip creation.
 *
 * COLUMN INDEX REFERENCE (1-based, for getRange):
 *   A =  1  Timestamp
 *   B =  2  DRA Name
 *   C =  3  DRA Email
 *   D =  4  District
 *   E =  5  Referee #
 *   F =  6  First Name
 *   G =  7  Last Name
 *   H =  8  Referee Email
 *   I =  9  Phone
 *   J = 10  Age
 *   K = 11  Max Age as AR
 *   L = 12  Max Age as Ref
 *   M = 13  Availability
 *   N = 14  Gender
 *   O = 15  Hotel Weekend 1
 *   P = 16  Hotel Weekend 2
 *   Q = 17  DRA Notes
 *   R = 18  Token
 *   S = 19  Status          <-- 3-value dropdown: Not Sent / Sent / Confirmed
 *   T = 20  SentAt
 *   U = 21  SubmittedAt
 *   V = 22  RefWeekend1
 *   W = 23  RefWeekend2
 *   X = 24  LateFlag        <-- renamed from RefHotel in v1.0
 *   Y = 25  RefNotes
 *   Z = 26  (blank — ConfirmationDeadline named range target; enter date here)
 *  AA = 27  "Confirmation Deadline:" label
 *
 * v1.0 -> v2.0 CHANGES:
 *   Status values: Not Sent / Pending / Confirmed / Declined (4)
 *              --> Not Sent / Sent / Confirmed (3)
 *   Column U: ConfirmedAt --> SubmittedAt
 *   Column X: RefHotel    --> LateFlag
 *   Columns I-N: DRA-provided details --> Referee-provided details (writer change)
 *   Column N: Hotel Weekend 1 (DRA) --> Gender (Referee)
 */


// ---------------------------------------------------------------------------
// COLUMN INDEX CONSTANTS (1-based, for use with getRange)
// ---------------------------------------------------------------------------

var COL_TIMESTAMP    =  1; // A
var COL_DRA_NAME     =  2; // B
var COL_DRA_EMAIL    =  3; // C
var COL_DISTRICT     =  4; // D
var COL_REF_NUMBER   =  5; // E
var COL_FIRST_NAME   =  6; // F
var COL_LAST_NAME    =  7; // G
var COL_REF_EMAIL    =  8; // H
var COL_PHONE        =  9; // I
var COL_AGE          = 10; // J
var COL_MAX_AGE_AR   = 11; // K
var COL_MAX_AGE_REF  = 12; // L
var COL_AVAILABILITY = 13; // M
var COL_GENDER       = 14; // N
var COL_HOTEL_WKD1   = 15; // O
var COL_HOTEL_WKD2   = 16; // P
var COL_DRA_NOTES    = 17; // Q
var COL_TOKEN        = 18; // R
var COL_STATUS       = 19; // S
var COL_SENT_AT      = 20; // T
var COL_SUBMITTED_AT = 21; // U
var COL_REF_WEEKEND1 = 22; // V
var COL_REF_WEEKEND2 = 23; // W
var COL_LATE_FLAG    = 24; // X
var COL_REF_NOTES    = 25; // Y
var COL_DEADLINE     = 26; // Z — named range target
var COL_LABEL        = 27; // AA — "Confirmation Deadline:" label

// Status values (v2.0 — exactly 3)
var STATUS_NOT_SENT  = 'Not Sent';
var STATUS_SENT      = 'Sent';
var STATUS_CONFIRMED = 'Confirmed';

// Locked header array (A-Z, 26 columns).
// Index 0 = column A, index 25 = column Z.
// Z1 is intentionally blank — it is the named range value cell.
var HEADERS_V2 = [
  'Timestamp',       // A  col 1
  'DRA Name',        // B  col 2
  'DRA Email',       // C  col 3
  'District',        // D  col 4
  'Referee #',       // E  col 5
  'First Name',      // F  col 6
  'Last Name',       // G  col 7
  'Referee Email',   // H  col 8
  'Phone',           // I  col 9
  'Age',             // J  col 10
  'Max Age as AR',   // K  col 11
  'Max Age as Ref',  // L  col 12
  'Availability',    // M  col 13
  'Gender',          // N  col 14
  'Hotel Weekend 1', // O  col 15
  'Hotel Weekend 2', // P  col 16
  'DRA Notes',       // Q  col 17
  'Token',           // R  col 18
  'Status',          // S  col 19
  'SentAt',          // T  col 20
  'SubmittedAt',     // U  col 21
  'RefWeekend1',     // V  col 22
  'RefWeekend2',     // W  col 23
  'LateFlag',        // X  col 24  (was RefHotel in v1.0)
  'RefNotes',        // Y  col 25
  ''                 // Z  col 26  (ConfirmationDeadline — leave blank)
];


// ---------------------------------------------------------------------------
// MAIN ORCHESTRATOR
// ---------------------------------------------------------------------------

/**
 * Main entry point. Runs all setup steps in the correct order.
 * Call this from the Apps Script function dropdown.
 */
function setupSchemaV2() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();

  Logger.log('=== setupSchemaV2 START ===');
  Logger.log('Sheet: ' + sheet.getName() +
             ' | Current cols: ' + sheet.getLastColumn() +
             ' | Current rows: ' + sheet.getLastRow());

  // Step 1: Rebuild all headers A-Z
  _rebuildHeaderRow(sheet);

  // Step 2: Clear data rows (fresh start)
  _clearDataRows(sheet);

  // Step 3: Clear old S-column validation, apply v2.0 3-value dropdown
  _applyStatusValidation(sheet);

  // Step 4: Create ConfirmationDeadline named range at Z1
  _createDeadlineNamedRange(ss, sheet);

  // Step 5: Clear old conditional formatting, apply v2.0 3-rule color coding
  _applyConditionalFormatting(sheet);

  Logger.log('=== setupSchemaV2 COMPLETE ===');
  Logger.log('ACTION REQUIRED: Enter the confirmation deadline date in cell Z1.');
}


// ---------------------------------------------------------------------------
// STEP 1: REBUILD HEADER ROW A-Z
// ---------------------------------------------------------------------------

/**
 * Public standalone wrapper — run individually from function dropdown.
 */
function rebuildHeaderRow() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  _rebuildHeaderRow(sheet);
}

/**
 * Writes all 26 headers in a single setValues call to row 1, columns 1-26.
 * Unconditional — always overwrites regardless of current header state.
 * Uses the HEADERS_V2 constant array as the single source of truth.
 */
function _rebuildHeaderRow(sheet) {
  Logger.log('Step 1: Rebuilding header row A-Z...');
  sheet.getRange(1, 1, 1, 26).setValues([HEADERS_V2]);

  // Write label in AA1 so the assignor knows to enter the deadline in Z1.
  // Check if already present before writing (idempotent).
  var labelCell = sheet.getRange(1, COL_LABEL, 1, 1);
  var existingLabel = labelCell.getValue();
  if (existingLabel === '') {
    labelCell.setValue('Confirmation Deadline:');
    Logger.log('  AA1 label written: "Confirmation Deadline:"');
  } else {
    Logger.log('  AA1 already has content ("' + existingLabel + '"). Skipping label write.');
  }

  Logger.log('  Headers rebuilt: A=Timestamp through Y=RefNotes, Z=blank (deadline cell)');
}


// ---------------------------------------------------------------------------
// STEP 2: CLEAR DATA ROWS
// ---------------------------------------------------------------------------

/**
 * Public standalone wrapper — run individually from function dropdown.
 */
function clearDataRows() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  _clearDataRows(sheet);
}

/**
 * Clears all data rows A2:Z{lastRow}. Preserves header row 1.
 * Per CONTEXT.md: the sheet is essentially empty — no real v1.0 data to migrate.
 * Clearing is a clean-slate operation; validation, named range, and formatting
 * are re-applied by subsequent steps.
 */
function _clearDataRows(sheet) {
  Logger.log('Step 2: Clearing data rows...');
  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    Logger.log('  No data rows to clear (lastRow = ' + lastRow + '). Header preserved.');
    return;
  }

  var dataRowCount = lastRow - 1;
  sheet.getRange(2, 1, dataRowCount, 26).clearContent();
  Logger.log('  Cleared ' + dataRowCount + ' data row(s). Headers preserved in row 1.');
}


// ---------------------------------------------------------------------------
// STEP 3: APPLY STATUS VALIDATION (v2.0 — 3 values)
// ---------------------------------------------------------------------------

/**
 * Public standalone wrapper — run individually from function dropdown.
 */
function applyStatusValidation() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  _applyStatusValidation(sheet);
}

/**
 * Clears any existing validation on column S (catches stale v1.0 rules
 * that may have been set on a different range), then applies the v2.0
 * 3-value dropdown to S2:S500 with rejection of invalid values.
 *
 * Key difference from v1.0: clears entire column S before applying,
 * preventing stale 4-value rules from persisting alongside the new 3-value rule.
 */
function _applyStatusValidation(sheet) {
  Logger.log('Step 3: Applying status validation...');

  // Clear old validation from entire column S before applying new rule.
  // This catches cases where v1.0 rules were set on a different range
  // (e.g., S2:S1000) that would otherwise persist alongside the new rule.
  sheet.getRange('S:S').clearDataValidations();
  Logger.log('  Old validation cleared from column S.');

  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList([STATUS_NOT_SENT, STATUS_SENT, STATUS_CONFIRMED], true)
    .setAllowInvalid(false)
    .build();

  // Apply to S2:S500. Row 1 is the header — excluded intentionally.
  sheet.getRange('S2:S500').setDataValidation(rule);

  Logger.log('  Validation applied to S2:S500.');
  Logger.log('  Allowed values: Not Sent / Sent / Confirmed');
  Logger.log('  Invalid values: REJECTED (not just warned)');
}


// ---------------------------------------------------------------------------
// STEP 4: CREATE CONFIRMATION DEADLINE NAMED RANGE
// ---------------------------------------------------------------------------

/**
 * Public standalone wrapper — run individually from function dropdown.
 */
function createDeadlineNamedRange() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  _createDeadlineNamedRange(ss, sheet);
}

/**
 * Creates the ConfirmationDeadline named range pointing to Z1.
 * Idempotent: checks for existence before creating (Apps Script does not
 * overwrite on setNamedRange if a range with the same name exists — calling
 * it twice creates a duplicate, which is why we guard first).
 *
 * All subsequent phases read the deadline via:
 *   ss.getRangeByName('ConfirmationDeadline').getValue()
 */
function _createDeadlineNamedRange(ss, sheet) {
  Logger.log('Step 4: Creating ConfirmationDeadline named range...');
  var rangeName = 'ConfirmationDeadline';

  var existing = ss.getRangeByName(rangeName);
  if (existing) {
    Logger.log('  Named range "' + rangeName + '" already exists at ' +
               existing.getA1Notation() + '. Skipping create.');
  } else {
    ss.setNamedRange(rangeName, sheet.getRange('Z1'));
    Logger.log('  Named range "' + rangeName + '" created at Z1.');
  }

  Logger.log('  ACTION: Enter confirmation deadline date in cell Z1.');
}


// ---------------------------------------------------------------------------
// STEP 5: APPLY CONDITIONAL FORMATTING (v2.0 — 3 rules)
// ---------------------------------------------------------------------------

/**
 * Public standalone wrapper — run individually from function dropdown.
 */
function applyConditionalFormatting() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  _applyConditionalFormatting(sheet);
}

/**
 * Clears all existing conditional format rules on the sheet, then applies
 * 3 color-coding rules for Status column S2:S500.
 *
 * WARNING: clearConditionalFormatRules() is sheet-wide. Any custom conditional
 * formatting you added manually will be removed. Re-apply after running setup.
 *
 * Color scheme (v2.0 — 3 values, no Pending/Declined):
 *   Not Sent  — gray   background (#e8eaed), dark gray text (#3c4043)
 *   Sent      — yellow background (#fef9c3), dark yellow text (#854d0e)
 *   Confirmed — green  background (#dcfce7), dark green text (#166534)
 */
function _applyConditionalFormatting(sheet) {
  Logger.log('Step 5: Applying conditional formatting...');

  // Clear all existing rules to prevent accumulation on re-run.
  sheet.clearConditionalFormatRules();
  Logger.log('  Old conditional format rules cleared (sheet-wide).');

  var range = sheet.getRange('S2:S500');
  var rules = [];

  // Not Sent — gray
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(STATUS_NOT_SENT)
      .setBackground('#e8eaed')
      .setFontColor('#3c4043')
      .setRanges([range])
      .build()
  );

  // Sent — yellow
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(STATUS_SENT)
      .setBackground('#fef9c3')
      .setFontColor('#854d0e')
      .setRanges([range])
      .build()
  );

  // Confirmed — green
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(STATUS_CONFIRMED)
      .setBackground('#dcfce7')
      .setFontColor('#166534')
      .setRanges([range])
      .build()
  );

  sheet.setConditionalFormatRules(rules);

  Logger.log('  3 conditional format rules applied to S2:S500.');
  Logger.log('  Not Sent=gray, Sent=yellow, Confirmed=green');
}
