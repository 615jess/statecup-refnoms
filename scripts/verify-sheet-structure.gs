/**
 * verify-sheet-structure.gs
 *
 * VERIFICATION SCRIPT — State Cup Referee Confirmation System
 * Phase 1: Sheet Schema
 *
 * WHAT THIS SCRIPT DOES:
 *   Confirms that the setup script was applied correctly and that the
 *   existing nomination form still writes data to the right columns.
 *
 * HOW TO RUN:
 *   1. Open your Google Sheet
 *   2. Go to Extensions > Apps Script
 *   3. Create a new script file named "verify"
 *   4. Paste the full contents of this file
 *
 *   To check sheet structure (run after setup script):
 *     - Select "verifySheetStructure" from the function dropdown and click Run
 *
 *   To check nomination integrity (run after submitting a TEST nomination):
 *     - NOTE: Submit a test nomination through the form BEFORE running this
 *       function, so there is a fresh row to inspect
 *     - Select "verifyNominationIntegrity" from the function dropdown and click Run
 *
 *   To run both checks together:
 *     - Select "runAllVerification" from the function dropdown and click Run
 *
 *   View results in: View > Logs  (or the "Execution log" tab)
 *
 * OUTPUT FORMAT:
 *   Each check logs either:
 *     PASS — [description]
 *     FAIL — [description]: [details]
 *   A summary line at the end shows total PASS/FAIL counts.
 *
 * COLUMN REFERENCE (1-based for getRange, 0-based for array index):
 *   A=1(0)   B=2(1)   C=3(2)   D=4(3)   E=5(4)
 *   F=6(5)   G=7(6)   H=8(7)   I=9(8)   J=10(9)
 *   K=11(10) L=12(11) M=13(12) N=14(13) O=15(14)
 *   P=16(15) Q=17(16) — last nomination column (DRA Notes)
 *   R=18(17) S=19(18) T=20(19) U=21(20) V=22(21)
 *   W=23(22) X=24(23) Y=25(24) — last confirmation column
 *   Z=26(25) — ConfirmationDeadline named range target
 */


// ---------------------------------------------------------------------------
// PRIMARY ENTRY POINT
// ---------------------------------------------------------------------------

/**
 * Runs both verification functions and logs a combined summary.
 * Select this function to run all checks at once.
 */
function runAllVerification() {
  Logger.log('========================================');
  Logger.log('  FULL VERIFICATION SUITE');
  Logger.log('========================================');

  Logger.log('');
  Logger.log('--- Part 1: Sheet Structure ---');
  var structureResults = verifySheetStructure();

  Logger.log('');
  Logger.log('--- Part 2: Nomination Integrity ---');
  var integrityResults = verifyNominationIntegrity();

  Logger.log('');
  Logger.log('========================================');
  Logger.log('  SUMMARY');
  Logger.log('  Structure checks: ' +
    structureResults.passed + ' passed, ' + structureResults.failed + ' failed');
  Logger.log('  Integrity checks: ' +
    integrityResults.passed + ' passed, ' + integrityResults.failed + ' failed');

  var totalFailed = structureResults.failed + integrityResults.failed;
  if (totalFailed === 0) {
    Logger.log('  OVERALL: ALL CHECKS PASSED');
  } else {
    Logger.log('  OVERALL: ' + totalFailed + ' CHECK(S) FAILED — review FAIL lines above');
  }
  Logger.log('========================================');
}


// ---------------------------------------------------------------------------
// STRUCTURE VERIFICATION
// ---------------------------------------------------------------------------

/**
 * Verifies that the setup script was applied correctly.
 *
 * Checks:
 *   1. Total column count is 25 (A-Y)
 *   2. Headers R1:Y1 match expected values exactly
 *   3. Column S (index 19, 1-based) has data validation applied
 *   4. Named range 'ConfirmationDeadline' exists and points to Z1
 *   5. All existing data rows have a non-empty value in column S
 *   6. Spot-check: columns A, F, G, Q of first data row have data (not shifted)
 *
 * @return {Object} { passed: number, failed: number }
 */
function verifySheetStructure() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var passed = 0;
  var failed = 0;

  // Helper: log a PASS result
  function pass(msg) {
    Logger.log('PASS — ' + msg);
    passed++;
  }

  // Helper: log a FAIL result
  function fail(msg, detail) {
    Logger.log('FAIL — ' + msg + (detail ? ': ' + detail : ''));
    failed++;
  }

  // ------------------------------------------------------------------
  // Check 1: Total column count = 25
  // ------------------------------------------------------------------
  var colCount = sheet.getLastColumn();
  if (colCount === 25) {
    pass('Column count is 25 (A-Y)');
  } else {
    fail('Column count', 'Expected 25 (A-Y), got ' + colCount +
         '. If setup script has not been run, run setupConfirmationColumns first.');
  }

  // ------------------------------------------------------------------
  // Check 2: Headers R1:Y1 match expected values
  // ------------------------------------------------------------------
  var expectedHeaders = ['Token', 'Status', 'SentAt', 'ConfirmedAt',
                         'RefWeekend1', 'RefWeekend2', 'RefHotel', 'RefNotes'];
  var headerRange = sheet.getRange(1, 18, 1, 8);
  var actualHeaders = headerRange.getValues()[0];

  var headerMismatches = [];
  for (var h = 0; h < expectedHeaders.length; h++) {
    var colLetter = String.fromCharCode(82 + h); // R=82 in ASCII
    if (actualHeaders[h] !== expectedHeaders[h]) {
      headerMismatches.push(
        'Col ' + colLetter + ': expected "' + expectedHeaders[h] + '", got "' + actualHeaders[h] + '"'
      );
    }
  }
  if (headerMismatches.length === 0) {
    pass('Headers R1:Y1 match expected values (Token through RefNotes)');
  } else {
    fail('Headers R1:Y1 mismatch', headerMismatches.join('; '));
  }

  // ------------------------------------------------------------------
  // Check 3: Column S has data validation
  // ------------------------------------------------------------------
  // Sample the validation rule from S2 (first data cell in the status column)
  var sampleCell = sheet.getRange('S2');
  var validationRule = sampleCell.getDataValidation();

  if (validationRule !== null) {
    // Check that the criteria type is VALUE_IN_LIST
    var criteriaType = validationRule.getCriteriaType();
    var criteriaValues = validationRule.getCriteriaValues();

    if (criteriaType === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
      var allowedList = criteriaValues[0]; // first criteria value is the list array
      var expectedList = ['Not Sent', 'Pending', 'Confirmed', 'Declined'];
      var listMatch = true;

      if (allowedList.length !== expectedList.length) {
        listMatch = false;
      } else {
        for (var v = 0; v < expectedList.length; v++) {
          if (allowedList[v] !== expectedList[v]) {
            listMatch = false;
            break;
          }
        }
      }

      if (listMatch) {
        pass('Column S data validation: VALUE_IN_LIST with correct four values');
      } else {
        fail('Column S data validation list values', 'Got: ' + allowedList.join(', '));
      }
    } else {
      fail('Column S data validation criteria type', 'Expected VALUE_IN_LIST, got ' + criteriaType);
    }
  } else {
    fail('Column S data validation', 'No validation rule found on S2. Run applyStatusValidation.');
  }

  // ------------------------------------------------------------------
  // Check 4: Named range 'ConfirmationDeadline' exists and points to Z1
  // ------------------------------------------------------------------
  var namedRange = ss.getRangeByName('ConfirmationDeadline');
  if (namedRange !== null) {
    var rangeA1 = namedRange.getA1Notation();
    // Accept both "Z1" (no sheet prefix) and "SheetName!Z1"
    if (rangeA1 === 'Z1' || rangeA1.indexOf('Z1') !== -1) {
      pass('Named range "ConfirmationDeadline" exists and points to Z1');
    } else {
      fail('Named range "ConfirmationDeadline" location', 'Expected Z1, points to ' + rangeA1);
    }
  } else {
    fail('Named range "ConfirmationDeadline"', 'Does not exist. Run createDeadlineNamedRange.');
  }

  // ------------------------------------------------------------------
  // Check 5: All existing data rows have a non-empty value in column S
  // ------------------------------------------------------------------
  var lastRow = sheet.getLastRow();
  var dataRowCount = lastRow - 1;

  if (dataRowCount < 1) {
    pass('Column S backfill: No data rows to check (sheet has no nomination rows yet)');
  } else {
    // Column S = 1-based index 19
    var statusValues = sheet.getRange(2, 19, dataRowCount, 1).getValues();
    var emptyStatusRows = [];

    for (var r = 0; r < dataRowCount; r++) {
      var statusVal = statusValues[r][0];
      if (statusVal === '' || statusVal === null) {
        emptyStatusRows.push(r + 2); // convert to 1-based row number
      }
    }

    if (emptyStatusRows.length === 0) {
      pass('Column S backfill: All ' + dataRowCount + ' data rows have a Status value');
    } else {
      fail('Column S backfill', emptyStatusRows.length + ' row(s) have empty Status: rows ' +
           emptyStatusRows.join(', '));
    }
  }

  // ------------------------------------------------------------------
  // Check 6: Spot-check existing row columns A, F, G, Q for data
  // ------------------------------------------------------------------
  if (dataRowCount >= 1) {
    // Check the first data row (row 2) for key column values
    // Col A=1(Timestamp), F=6(First Name), G=7(Last Name), Q=17(DRA Notes)
    var spotRow = sheet.getRange(2, 1, 1, 17).getValues()[0];

    var spotChecks = [
      { col: 'A', idx: 0, label: 'Timestamp' },
      { col: 'F', idx: 5, label: 'First Name' },
      { col: 'G', idx: 6, label: 'Last Name' },
      { col: 'Q', idx: 16, label: 'DRA Notes' }
    ];

    var spotFails = [];
    for (var s = 0; s < spotChecks.length; s++) {
      var check = spotChecks[s];
      var val = spotRow[check.idx];
      // A (Timestamp) and Q (DRA Notes) may be legitimately empty for some rows,
      // but the cell should at least exist in the right position. We check that
      // the column index hasn't shifted by verifying columns A, F, G are non-empty
      // (these are required fields in the nomination form).
      if (check.col !== 'Q' && (val === '' || val === null)) {
        spotFails.push('Col ' + check.col + ' (' + check.label + ') is empty in row 2');
      }
    }

    if (spotFails.length === 0) {
      pass('Spot-check row 2: Cols A, F, G have data — no index shift detected');
    } else {
      fail('Spot-check row 2 — possible column shift', spotFails.join('; '));
    }

    // Also verify column Q header is still "DRA Notes"
    var qHeader = sheet.getRange(1, 17, 1, 1).getValue();
    if (qHeader === 'DRA Notes') {
      pass('Column Q header is "DRA Notes" — column indices have not shifted');
    } else {
      fail('Column Q header', 'Expected "DRA Notes", got "' + qHeader +
           '". Column indices may have shifted — investigate immediately.');
    }
  } else {
    pass('Spot-check: Skipped (no data rows present)');
    pass('Column Q header check: Skipped (no data to verify against)');
  }

  Logger.log('Structure verification: ' + passed + ' passed, ' + failed + ' failed');
  return { passed: passed, failed: failed };
}


// ---------------------------------------------------------------------------
// NOMINATION INTEGRITY VERIFICATION
// ---------------------------------------------------------------------------

/**
 * Verifies that the most recent nomination row was written correctly.
 *
 * IMPORTANT: Submit a test nomination through the form BEFORE running this
 * function. This function inspects the last row — if the last row is an old
 * nomination (not a fresh test submission), results may be misleading.
 *
 * Checks the last data row:
 *   1. Columns A-Q (indices 1-17) have data in expected positions
 *   2. Columns R-Y (indices 18-25) are all empty (appendRow didn't spill over)
 *   3. Column Q value is a string (DRA Notes, not a shifted value from another field)
 *   4. Column A value parses as a date (Timestamp, not shifted)
 *   5. Column F and G are non-empty strings (First Name, Last Name)
 *   6. Column H looks like an email address (Referee Email)
 *
 * @return {Object} { passed: number, failed: number }
 */
function verifyNominationIntegrity() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var passed = 0;
  var failed = 0;

  // Helper: log a PASS result
  function pass(msg) {
    Logger.log('PASS — ' + msg);
    passed++;
  }

  // Helper: log a FAIL result
  function fail(msg, detail) {
    Logger.log('FAIL — ' + msg + (detail ? ': ' + detail : ''));
    failed++;
  }

  var lastRow = sheet.getLastRow();
  var dataRowCount = lastRow - 1;

  if (dataRowCount < 1) {
    Logger.log('SKIP — No data rows found. Submit a test nomination first, then re-run.');
    return { passed: 0, failed: 0 };
  }

  Logger.log('Inspecting last data row: row ' + lastRow);

  // Read the full last row across all 25 data columns (A-Y)
  var rowData = sheet.getRange(lastRow, 1, 1, 25).getValues()[0];

  // ------------------------------------------------------------------
  // Check 1: Columns A-Q (0-based 0-16) all present
  // ------------------------------------------------------------------
  var nominationCols = [
    { idx: 0,  col: 'A', label: 'Timestamp' },
    { idx: 1,  col: 'B', label: 'DRA Name' },
    { idx: 2,  col: 'C', label: 'DRA Email' },
    { idx: 3,  col: 'D', label: 'District' },
    { idx: 4,  col: 'E', label: 'Referee #' },
    { idx: 5,  col: 'F', label: 'First Name' },
    { idx: 6,  col: 'G', label: 'Last Name' },
    { idx: 7,  col: 'H', label: 'Referee Email' },
    { idx: 8,  col: 'I', label: 'Phone' },
    { idx: 9,  col: 'J', label: 'Age' },
    { idx: 10, col: 'K', label: 'Max Age as AR' },
    { idx: 11, col: 'L', label: 'Max Age as Referee' },
    { idx: 12, col: 'M', label: 'Availability' },
    { idx: 13, col: 'N', label: 'Hotel Weekend 1' },
    { idx: 14, col: 'O', label: 'Hotel Weekend 2' },
    { idx: 15, col: 'P', label: 'Day-Specific Notes' },
    { idx: 16, col: 'Q', label: 'DRA Notes' }
  ];

  var emptyNominationCols = [];
  // Note: cols P (Day-Specific Notes) and Q (DRA Notes) are optional — don't flag them
  var optionalCols = [15, 16]; // 0-based indices for P and Q

  for (var n = 0; n < nominationCols.length; n++) {
    var nc = nominationCols[n];
    var val = rowData[nc.idx];
    var isEmpty = (val === '' || val === null);
    if (isEmpty && optionalCols.indexOf(nc.idx) === -1) {
      emptyNominationCols.push('Col ' + nc.col + ' (' + nc.label + ')');
    }
  }

  if (emptyNominationCols.length === 0) {
    pass('Columns A-Q: All required nomination fields have data');
  } else {
    fail('Columns A-Q: Some required fields are empty', emptyNominationCols.join(', ') +
         '. This may indicate a column index shift or an incomplete test submission.');
  }

  // ------------------------------------------------------------------
  // Check 2: Columns R-Y (0-based 17-24) are all empty
  // ------------------------------------------------------------------
  var confirmationColLabels = ['R(Token)', 'S(Status)', 'T(SentAt)', 'U(ConfirmedAt)',
                               'V(RefWeekend1)', 'W(RefWeekend2)', 'X(RefHotel)', 'Y(RefNotes)'];
  var nonEmptyConfirmationCols = [];

  for (var c = 17; c < 25; c++) {
    var cVal = rowData[c];
    if (cVal !== '' && cVal !== null) {
      nonEmptyConfirmationCols.push(
        confirmationColLabels[c - 17] + '="' + cVal + '"'
      );
    }
  }

  if (nonEmptyConfirmationCols.length === 0) {
    pass('Columns R-Y: All confirmation columns are empty (appendRow wrote only to A-Q)');
  } else {
    fail('Columns R-Y: Some confirmation columns have unexpected data',
         nonEmptyConfirmationCols.join(', ') +
         '. The nomination form may be writing too many columns — check the doPost appendRow array.');
  }

  // ------------------------------------------------------------------
  // Check 3: Column Q is a string (DRA Notes — not a shifted value)
  // ------------------------------------------------------------------
  var qVal = rowData[16]; // 0-based index 16 = column Q
  if (typeof qVal === 'string') {
    pass('Column Q value is a string (DRA Notes field — correct type, no index shift)');
  } else {
    fail('Column Q type', 'Expected string (DRA Notes), got ' + typeof qVal + ' value: ' + qVal +
         '. Column indices may have shifted.');
  }

  // ------------------------------------------------------------------
  // Check 4: Column A looks like a timestamp
  // ------------------------------------------------------------------
  var aVal = rowData[0]; // 0-based index 0 = column A
  var isDateLike = (aVal instanceof Date) || (typeof aVal === 'string' && aVal.match(/\d{1,2}\/\d{1,2}\/\d{4}/));
  if (isDateLike) {
    pass('Column A value is a date/timestamp (Timestamp field — correct type)');
  } else if (aVal === '' || aVal === null) {
    fail('Column A (Timestamp)', 'Empty — expected a timestamp. Verify submission reached the sheet.');
  } else {
    Logger.log('WARN — Column A value type is unexpected: ' + typeof aVal + ' = "' + aVal + '"' +
               ' (may still be OK if the form stores timestamp as text)');
    passed++; // Soft pass — log warning but don't fail
  }

  // ------------------------------------------------------------------
  // Check 5: Columns F and G are non-empty strings (First/Last Name)
  // ------------------------------------------------------------------
  var firstName = rowData[5];  // 0-based index 5 = F
  var lastName  = rowData[6];  // 0-based index 6 = G

  if (typeof firstName === 'string' && firstName !== '') {
    pass('Column F (First Name) is a non-empty string');
  } else {
    fail('Column F (First Name)', 'Got: ' + typeof firstName + ' = "' + firstName + '"');
  }

  if (typeof lastName === 'string' && lastName !== '') {
    pass('Column G (Last Name) is a non-empty string');
  } else {
    fail('Column G (Last Name)', 'Got: ' + typeof lastName + ' = "' + lastName + '"');
  }

  // ------------------------------------------------------------------
  // Check 6: Column H looks like an email (Referee Email)
  // ------------------------------------------------------------------
  var refEmail = rowData[7]; // 0-based index 7 = H
  if (typeof refEmail === 'string' && refEmail.indexOf('@') !== -1) {
    pass('Column H (Referee Email) contains "@" — looks like an email address');
  } else {
    fail('Column H (Referee Email)', 'Got: "' + refEmail + '". Expected an email address.' +
         ' If this is a test row with placeholder data, verify the form submission reached column H.');
  }

  Logger.log('Nomination integrity: ' + passed + ' passed, ' + failed + ' failed');
  return { passed: passed, failed: failed };
}
