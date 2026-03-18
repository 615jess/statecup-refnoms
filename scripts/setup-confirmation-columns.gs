/**
 * setup-confirmation-columns.gs
 *
 * ONE-TIME SETUP SCRIPT — State Cup Referee Confirmation System
 * Phase 1: Sheet Schema
 *
 * WHAT THIS SCRIPT DOES:
 *   1. Verifies the sheet has 17 columns (A-Q) before making any changes
 *   2. Adds 8 new column headers in R1:Y1:
 *      R=Token, S=Status, T=SentAt, U=ConfirmedAt,
 *      V=RefWeekend1, W=RefWeekend2, X=RefHotel, Y=RefNotes
 *   3. Backfills column S (Status) with "Not Sent" for all existing data rows
 *   4. Applies dropdown data validation on S2:S500 (four status values)
 *   5. Creates a named range 'ConfirmationDeadline' pointing to cell Z1
 *   6. Writes a label "Confirmation Deadline:" in AA1 so the assignor knows
 *      to enter the actual deadline date in Z1
 *   7. Applies conditional formatting on S2:S500 (color-coded by status)
 *
 * HOW TO RUN:
 *   1. Open your Google Sheet
 *   2. Go to Extensions > Apps Script
 *   3. Create a new script file (click + next to "Files") and name it "setup"
 *   4. Delete any placeholder code and paste the full contents of this file
 *   5. Select "setupConfirmationColumns" from the function dropdown
 *   6. Click Run (play button)
 *   7. Authorize when prompted
 *   8. View > Logs (or the Execution log tab) to confirm success
 *   9. Return to the sheet and verify columns R-Y have headers
 *  10. Enter the actual tournament confirmation deadline date in cell Z1
 *
 * IDEMPOTENT:
 *   Safe to run more than once. The script checks whether setup has already
 *   been applied (column count = 25) and skips steps that are already done.
 *   It will NOT overwrite Status values that are already set.
 *
 * COLUMN INDEX REFERENCE (1-based, for getRange):
 *   R = 18 (Token)
 *   S = 19 (Status)        <-- backfilled with "Not Sent"
 *   T = 20 (SentAt)
 *   U = 21 (ConfirmedAt)
 *   V = 22 (RefWeekend1)
 *   W = 23 (RefWeekend2)
 *   X = 24 (RefHotel)
 *   Y = 25 (RefNotes)
 *   Z = 26 (ConfirmationDeadline — named range target)
 *  AA = 27 (label "Confirmation Deadline:")
 */


// ---------------------------------------------------------------------------
// MAIN ORCHESTRATOR
// ---------------------------------------------------------------------------

/**
 * Main entry point. Runs all setup steps in the correct order.
 * Call this from the Apps Script function dropdown.
 */
function setupConfirmationColumns() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();

  Logger.log('=== setupConfirmationColumns START ===');
  Logger.log('Sheet name: ' + sheet.getName());

  var currentColCount = sheet.getLastColumn();
  Logger.log('Current column count: ' + currentColCount);

  // Guard: if setup was already fully applied (25 columns A-Y), skip to
  // idempotent steps only (validation, named range, conditional formatting).
  if (currentColCount === 25) {
    Logger.log('INFO: Sheet already has 25 columns — headers likely already added.');
    Logger.log('Proceeding with idempotent steps (backfill empties, validation, named range, formatting).');
    _backfillStatusColumn(sheet);
    _applyStatusValidation(sheet);
    _createDeadlineNamedRange(ss, sheet);
    _applyConditionalFormatting(sheet);
    Logger.log('=== setupConfirmationColumns COMPLETE (idempotent re-run) ===');
    return;
  }

  // Guard: sheet must have exactly 17 columns (A-Q) to be in the expected
  // pre-setup state. Any other count is unexpected — abort.
  if (currentColCount !== 17) {
    throw new Error(
      'ABORT: Expected 17 columns (A-Q) before setup, but found ' +
      currentColCount + '. Verify you are running this on the correct sheet ' +
      'and that no columns have been added or removed since the nomination form was set up.'
    );
  }

  // Step 1: Add headers R1:Y1
  _addConfirmationHeaders(sheet);

  // Step 2: Backfill column S with "Not Sent" for existing data rows
  _backfillStatusColumn(sheet);

  // Step 3: Apply dropdown data validation on S2:S500
  _applyStatusValidation(sheet);

  // Step 4: Create named range ConfirmationDeadline at Z1
  _createDeadlineNamedRange(ss, sheet);

  // Step 5: Apply conditional formatting on column S
  _applyConditionalFormatting(sheet);

  Logger.log('=== setupConfirmationColumns COMPLETE ===');
  Logger.log('NEXT STEP: Enter the actual confirmation deadline date in cell Z1.');
}


// ---------------------------------------------------------------------------
// STEP 1: ADD COLUMN HEADERS
// ---------------------------------------------------------------------------

/**
 * Adds the 8 new column headers to row 1, columns R-Y (1-based: 18-25).
 * Uses getRange().setValues() — never insertColumns or appendRow.
 *
 * Can also be run standalone.
 */
function addConfirmationHeaders() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  _addConfirmationHeaders(sheet);
}

function _addConfirmationHeaders(sheet) {
  // Verify we are at column 17 (pre-setup state) before appending.
  // If already at 25, headers are already present — log and return.
  var colCount = sheet.getLastColumn();
  if (colCount === 25) {
    Logger.log('SKIP _addConfirmationHeaders: Headers already present (25 columns).');
    return;
  }
  if (colCount !== 17) {
    throw new Error(
      '_addConfirmationHeaders: Expected 17 columns, found ' + colCount + '. Aborting header add.'
    );
  }

  // Set R1:Y1 headers. Column 18 (R) through 25 (Y), 1-based.
  sheet.getRange(1, 18, 1, 8).setValues([[
    'Token', 'Status', 'SentAt', 'ConfirmedAt',
    'RefWeekend1', 'RefWeekend2', 'RefHotel', 'RefNotes'
  ]]);

  Logger.log('Headers added: R1=Token, S1=Status, T1=SentAt, U1=ConfirmedAt, ' +
             'V1=RefWeekend1, W1=RefWeekend2, X1=RefHotel, Y1=RefNotes');
}


// ---------------------------------------------------------------------------
// STEP 2: BACKFILL STATUS COLUMN
// ---------------------------------------------------------------------------

/**
 * Writes "Not Sent" to column S for all existing data rows that currently
 * have an empty Status cell. Skips rows that already have a Status value
 * (idempotent — safe to re-run).
 *
 * Can also be run standalone.
 */
function backfillStatusColumn() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  _backfillStatusColumn(sheet);
}

function _backfillStatusColumn(sheet) {
  var lastRow = sheet.getLastRow(); // includes header row 1
  var dataRowCount = lastRow - 1;  // subtract header

  if (dataRowCount < 1) {
    Logger.log('_backfillStatusColumn: No data rows found. Nothing to backfill.');
    return;
  }

  // Column S = 1-based index 19
  var statusCol = 19;

  // Read existing Status values to skip rows that are already set
  var existingValues = sheet.getRange(2, statusCol, dataRowCount, 1).getValues();

  var newValues = [];
  var filledCount = 0;
  var skippedCount = 0;

  for (var i = 0; i < dataRowCount; i++) {
    var current = existingValues[i][0];
    if (current === '' || current === null) {
      newValues.push(['Not Sent']);
      filledCount++;
    } else {
      // Keep existing value unchanged
      newValues.push([current]);
      skippedCount++;
    }
  }

  // Write all values back (including the unchanged ones to keep the range contiguous)
  sheet.getRange(2, statusCol, dataRowCount, 1).setValues(newValues);

  Logger.log('_backfillStatusColumn: Wrote "Not Sent" to ' + filledCount +
             ' rows. Skipped ' + skippedCount + ' rows (already had a status value).');
}


// ---------------------------------------------------------------------------
// STEP 3: APPLY DROPDOWN DATA VALIDATION
// ---------------------------------------------------------------------------

/**
 * Applies a dropdown data validation rule to S2:S500, restricting values to:
 *   Not Sent | Pending | Confirmed | Declined
 *
 * setAllowInvalid(false) means the sheet will reject values outside this list.
 * requireValueInList(values, true) — the second arg (true) shows the dropdown arrow.
 *
 * Can also be run standalone.
 */
function applyStatusValidation() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  _applyStatusValidation(sheet);
}

function _applyStatusValidation(sheet) {
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Not Sent', 'Pending', 'Confirmed', 'Declined'], true)
    .setAllowInvalid(false)
    .build();

  // Apply to column S rows 2-500. Row 1 is the header — excluded intentionally.
  sheet.getRange('S2:S500').setDataValidation(rule);

  Logger.log('_applyStatusValidation: Dropdown validation applied to S2:S500.');
  Logger.log('  Allowed values: Not Sent, Pending, Confirmed, Declined');
}


// ---------------------------------------------------------------------------
// STEP 4: CREATE NAMED RANGE FOR CONFIRMATION DEADLINE
// ---------------------------------------------------------------------------

/**
 * Creates a named range 'ConfirmationDeadline' pointing to cell Z1.
 * Also writes a label "Confirmation Deadline:" in AA1 so the assignor
 * sees which cell to enter the deadline date in.
 *
 * Idempotent: checks for existing named range before creating.
 *
 * The assignor enters the actual deadline date directly into cell Z1.
 * Apps Script code in Phase 2+ reads it via:
 *   ss.getRangeByName('ConfirmationDeadline').getValue()
 *
 * Can also be run standalone.
 */
function createDeadlineNamedRange() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  _createDeadlineNamedRange(ss, sheet);
}

function _createDeadlineNamedRange(ss, sheet) {
  var rangeName = 'ConfirmationDeadline';

  // Check if named range already exists (idempotent)
  var existing = ss.getRangeByName(rangeName);
  if (existing) {
    Logger.log('_createDeadlineNamedRange: Named range "' + rangeName +
               '" already exists at ' + existing.getA1Notation() + '. Skipping create.');
  } else {
    var deadlineCell = sheet.getRange('Z1');
    ss.setNamedRange(rangeName, deadlineCell);
    Logger.log('_createDeadlineNamedRange: Named range "' + rangeName + '" created at Z1.');
  }

  // Write label in AA1 (column 27, 1-based) so the assignor knows cell Z1's purpose.
  // Check if label already present before writing.
  var labelCell = sheet.getRange(1, 27, 1, 1);
  var existingLabel = labelCell.getValue();
  if (existingLabel === '') {
    labelCell.setValue('Confirmation Deadline:');
    Logger.log('_createDeadlineNamedRange: Label "Confirmation Deadline:" written to AA1.');
  } else {
    Logger.log('_createDeadlineNamedRange: AA1 already has content ("' + existingLabel + '"). Skipping label write.');
  }

  Logger.log('ACTION REQUIRED: Enter the actual tournament confirmation deadline date in cell Z1.');
}


// ---------------------------------------------------------------------------
// STEP 5: CONDITIONAL FORMATTING FOR STATUS COLUMN
// ---------------------------------------------------------------------------

/**
 * Applies conditional formatting to S2:S500 to color-code status values:
 *   Not Sent  — light gray  background (#e8eaed), dark gray text (#3c4043)
 *   Pending   — light yellow background (#fef9c3), dark yellow text (#854d0e)
 *   Confirmed — light green  background (#dcfce7), dark green text  (#166534)
 *   Declined  — light red    background (#fee2e2), dark red text    (#991b1b)
 *
 * Clears any existing conditional formatting rules on column S before
 * applying new ones (replaces rather than accumulates on re-run).
 *
 * Can also be run standalone.
 */
function applyConditionalFormatting() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  _applyConditionalFormatting(sheet);
}

function _applyConditionalFormatting(sheet) {
  var range = sheet.getRange('S2:S500');

  // Remove all existing conditional format rules from this sheet to avoid
  // accumulating duplicates on re-run. (Rules are sheet-wide in Apps Script.)
  sheet.clearConditionalFormatRules();

  var rules = [];

  // Not Sent — gray
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Not Sent')
      .setBackground('#e8eaed')
      .setFontColor('#3c4043')
      .setRanges([range])
      .build()
  );

  // Pending — yellow
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Pending')
      .setBackground('#fef9c3')
      .setFontColor('#854d0e')
      .setRanges([range])
      .build()
  );

  // Confirmed — green
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Confirmed')
      .setBackground('#dcfce7')
      .setFontColor('#166534')
      .setRanges([range])
      .build()
  );

  // Declined — red
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Declined')
      .setBackground('#fee2e2')
      .setFontColor('#991b1b')
      .setRanges([range])
      .build()
  );

  sheet.setConditionalFormatRules(rules);

  Logger.log('_applyConditionalFormatting: 4 conditional format rules applied to S2:S500.');
  Logger.log('  Not Sent=gray, Pending=yellow, Confirmed=green, Declined=red');
}
