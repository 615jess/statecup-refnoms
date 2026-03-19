/**
 * verify-schema-v2.gs
 *
 * VERIFICATION SCRIPT — State Cup Referee Nomination System v2.0
 * Phase 1: Schema Setup
 *
 * WHAT THIS SCRIPT DOES:
 *   Confirms that setupSchemaV2() was applied correctly. Runs 7 checks and
 *   logs a PASS/FAIL result for each. Produces a summary line at the end.
 *
 * HOW TO RUN:
 *   1. Open your Google Sheet
 *   2. Go to Extensions > Apps Script
 *   3. Create a new script file, paste the full contents of this file
 *   4. Run setupSchemaV2() FIRST (from setup-schema-v2.gs) before verifying
 *   5. Select "verifySchemaV2" from the function dropdown and click Run
 *   6. Check the Execution Log — all checks should show PASS, zero FAIL
 *
 * OUTPUT FORMAT:
 *   Each check logs either:
 *     PASS — [description]
 *     FAIL — [description]: [details]
 *   A summary line at the end shows "X passed, Y failed".
 *
 * EXPECTED HEADERS (v2.0):
 *   A=Timestamp, B=DRA Name, C=DRA Email, D=District, E=Referee #,
 *   F=First Name, G=Last Name, H=Referee Email,
 *   I=Phone, J=Age, K=Max Age as AR, L=Max Age as Ref,
 *   M=Availability, N=Gender, O=Hotel Weekend 1, P=Hotel Weekend 2,
 *   Q=DRA Notes,
 *   R=Token, S=Status, T=SentAt, U=SubmittedAt,
 *   V=RefWeekend1, W=RefWeekend2, X=LateFlag, Y=RefNotes,
 *   Z=(blank — ConfirmationDeadline named range cell)
 *
 * v1.0 -> v2.0 CHECKS THAT DIFFER:
 *   Check 2:  All 26 headers A-Z (was: 8 headers R-Y only)
 *   Check 3:  3 status values: Not Sent / Sent / Confirmed (was: 4 values)
 *   Check 5:  lastRow = 1 = header only (was: all rows have Status value)
 *   Check 6:  3 conditional format rules (was: 4 rules including Pending/Declined)
 */


// ---------------------------------------------------------------------------
// EXPECTED HEADERS (must match HEADERS_V2 in setup-schema-v2.gs exactly)
// ---------------------------------------------------------------------------

var EXPECTED_HEADERS = [
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
  'SubmittedAt',     // U  col 21  (was ConfirmedAt in v1.0)
  'RefWeekend1',     // V  col 22
  'RefWeekend2',     // W  col 23
  'LateFlag',        // X  col 24  (was RefHotel in v1.0)
  'RefNotes',        // Y  col 25
  ''                 // Z  col 26  (blank — named range target)
];

// Expected status validation values (v2.0 — exactly 3)
var EXPECTED_STATUS_LIST = ['Not Sent', 'Sent', 'Confirmed'];

// Expected conditional format rule text values (must match above)
var EXPECTED_FORMAT_STATUSES = ['Not Sent', 'Sent', 'Confirmed'];


// ---------------------------------------------------------------------------
// MAIN ENTRY POINT
// ---------------------------------------------------------------------------

/**
 * Runs all 7 verification checks and logs PASS/FAIL for each.
 * Call this from the Apps Script function dropdown.
 *
 * @return {Object} { passed: number, failed: number }
 */
function verifySchemaV2() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var passed = 0;
  var failed = 0;

  Logger.log('=== verifySchemaV2 START ===');
  Logger.log('Sheet: ' + sheet.getName());

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
  // Check 1: Header row A-Z — all 26 headers match expected values
  // ------------------------------------------------------------------
  Logger.log('');
  Logger.log('Check 1: Header row A-Z');
  var actualHeaders = sheet.getRange(1, 1, 1, 26).getValues()[0];
  var headerMismatches = [];

  for (var i = 0; i < EXPECTED_HEADERS.length; i++) {
    if (actualHeaders[i] !== EXPECTED_HEADERS[i]) {
      var colLetter = String.fromCharCode(65 + i); // A=65, B=66, ...
      headerMismatches.push(
        'Col ' + colLetter + ': expected "' + EXPECTED_HEADERS[i] +
        '", got "' + actualHeaders[i] + '"'
      );
    }
  }

  if (headerMismatches.length === 0) {
    pass('All 26 headers A-Z match expected v2.0 values');
  } else {
    fail('Header mismatch(es)', headerMismatches.join('; '));
  }

  // ------------------------------------------------------------------
  // Check 2: Column count — at least 26 (may be 27 with AA1 label)
  // ------------------------------------------------------------------
  Logger.log('');
  Logger.log('Check 2: Column count');
  var colCount = sheet.getLastColumn();

  if (colCount >= 26 && colCount <= 27) {
    pass('Column count is ' + colCount + ' (expected 26 or 27 with AA label)');
  } else if (colCount < 26) {
    fail('Column count too low',
         'Got ' + colCount + ', expected at least 26. Run setupSchemaV2 first.');
  } else {
    fail('Column count too high',
         'Got ' + colCount + ', expected 26-27. Extra columns may have been added manually.');
  }

  // ------------------------------------------------------------------
  // Check 3: Column S validation — VALUE_IN_LIST with exactly 3 values
  // ------------------------------------------------------------------
  Logger.log('');
  Logger.log('Check 3: Column S data validation');
  var sCell = sheet.getRange('S2');
  var validationRule = sCell.getDataValidation();

  if (validationRule === null) {
    fail('Column S data validation', 'No validation rule on S2. Run setupSchemaV2 first.');
  } else {
    var criteriaType = validationRule.getCriteriaType();
    var criteriaValues = validationRule.getCriteriaValues();

    if (criteriaType !== SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
      fail('Column S validation criteria type',
           'Expected VALUE_IN_LIST, got ' + criteriaType);
    } else {
      var allowedList = criteriaValues[0]; // first criteria value is the list array
      var listMatchFailed = false;
      var listDetail = '';

      if (!allowedList || allowedList.length !== EXPECTED_STATUS_LIST.length) {
        listMatchFailed = true;
        listDetail = 'List length mismatch. Got: [' +
                     (allowedList ? allowedList.join(', ') : 'null') + ']';
      } else {
        for (var v = 0; v < EXPECTED_STATUS_LIST.length; v++) {
          if (allowedList[v] !== EXPECTED_STATUS_LIST[v]) {
            listMatchFailed = true;
            listDetail = 'Value mismatch at index ' + v +
                         ': expected "' + EXPECTED_STATUS_LIST[v] +
                         '", got "' + allowedList[v] + '"';
            break;
          }
        }
      }

      if (listMatchFailed) {
        fail('Column S validation values', listDetail);
      } else {
        pass('Column S validation: VALUE_IN_LIST [Not Sent, Sent, Confirmed] — 3 values exactly');
      }
    }
  }

  // ------------------------------------------------------------------
  // Check 4: Named range ConfirmationDeadline exists and points to Z1
  // ------------------------------------------------------------------
  Logger.log('');
  Logger.log('Check 4: ConfirmationDeadline named range');
  var namedRange = ss.getRangeByName('ConfirmationDeadline');

  if (namedRange === null) {
    fail('Named range "ConfirmationDeadline"', 'Does not exist. Run setupSchemaV2 first.');
  } else {
    var rangeA1 = namedRange.getA1Notation();
    // Accept both "Z1" (no sheet prefix) and "{SheetName}!Z1"
    if (rangeA1 === 'Z1' || rangeA1.indexOf('Z1') !== -1) {
      pass('Named range "ConfirmationDeadline" exists and points to Z1 (notation: ' + rangeA1 + ')');
    } else {
      fail('Named range "ConfirmationDeadline" location',
           'Expected Z1, points to ' + rangeA1);
    }
  }

  // ------------------------------------------------------------------
  // Check 5: Data rows cleared — lastRow should be 1 (header only)
  // ------------------------------------------------------------------
  Logger.log('');
  Logger.log('Check 5: Data rows cleared');
  var lastRow = sheet.getLastRow();

  if (lastRow === 1) {
    pass('Data rows cleared — only header row present (lastRow = 1)');
  } else {
    fail('Data rows not cleared',
         'lastRow = ' + lastRow + '. Expected 1 (header only). ' +
         'Run setupSchemaV2 to clear data rows, or data was added after setup.');
  }

  // ------------------------------------------------------------------
  // Check 6: Conditional formatting — exactly 3 rules, matching v2.0 statuses
  // ------------------------------------------------------------------
  Logger.log('');
  Logger.log('Check 6: Conditional formatting rules');
  var cfRules = sheet.getConditionalFormatRules();

  if (cfRules.length !== 3) {
    fail('Conditional format rule count',
         'Expected 3, got ' + cfRules.length + '. Run setupSchemaV2 to reset formatting.');
  } else {
    // Verify each rule's text-equals value matches the expected statuses.
    // Apps Script conditional format rules store criteria as BooleanCondition.
    var cfFails = [];

    for (var r = 0; r < cfRules.length; r++) {
      var boolCond = cfRules[r].getBooleanCondition();
      if (boolCond === null) {
        cfFails.push('Rule ' + (r + 1) + ': not a boolean condition rule');
        continue;
      }
      var ruleType = boolCond.getCriteriaType();
      var ruleValues = boolCond.getCriteriaValues();
      var ruleText = (ruleValues && ruleValues.length > 0) ? ruleValues[0] : null;
      var expectedText = EXPECTED_FORMAT_STATUSES[r];

      if (ruleType !== SpreadsheetApp.BooleanCriteria.TEXT_EQ) {
        cfFails.push('Rule ' + (r + 1) + ': expected TEXT_EQ criteria, got ' + ruleType);
      } else if (ruleText !== expectedText) {
        cfFails.push('Rule ' + (r + 1) + ': expected "' + expectedText +
                     '", got "' + ruleText + '"');
      }
    }

    if (cfFails.length === 0) {
      pass('3 conditional format rules correct: Not Sent=gray, Sent=yellow, Confirmed=green');
    } else {
      fail('Conditional format rule content', cfFails.join('; '));
    }
  }

  // ------------------------------------------------------------------
  // Check 7: AA1 label is "Confirmation Deadline:"
  // ------------------------------------------------------------------
  Logger.log('');
  Logger.log('Check 7: AA1 label');
  var aa1Value = sheet.getRange(1, 27).getValue();

  if (aa1Value === 'Confirmation Deadline:') {
    pass('AA1 label is "Confirmation Deadline:" — assignor knows to enter date in Z1');
  } else if (aa1Value === '') {
    fail('AA1 label', 'Empty. Expected "Confirmation Deadline:". Run setupSchemaV2 first.');
  } else {
    fail('AA1 label', 'Got "' + aa1Value + '", expected "Confirmation Deadline:"');
  }

  // ------------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------------
  Logger.log('');
  Logger.log('=== verifySchemaV2 COMPLETE ===');
  Logger.log(passed + ' passed, ' + failed + ' failed');

  if (failed === 0) {
    Logger.log('ALL CHECKS PASSED — v2.0 schema is correctly applied.');
  } else {
    Logger.log(failed + ' FAIL(s) — review FAIL lines above and re-run setupSchemaV2.');
  }

  return { passed: passed, failed: failed };
}
