/**
 * refdetails.gs
 *
 * Phase 3 + Phase 4 + Phase 7: Referee detail form — doGet endpoint, submitDetails handler,
 * Phase 4 getAllNominees routing, and Phase 7 getDRANominees routing.
 * Paste this file into the same Apps Script project as nominatev2.gs and adminemail.gs.
 *
 * WHAT THIS SCRIPT DOES:
 *   doGet(e) — routes incoming GET requests based on the action parameter:
 *     - action=getAllNominees → _handleGetAllNominees() in adminemail.gs (Phase 4)
 *     - action=getDRANominees → _handleGetDRANominees(draName) in adminemail.gs (Phase 7)
 *     - no action (token-based) → _handleGetDetails(token) below (Phase 3)
 *     Accepts a token query parameter (?token=...), looks up the referee row in
 *     the sheet, and returns all referee and tournament data as JSON so the
 *     referee-details.html form can populate itself on page load.
 *
 *   _handleSubmitDetails(payload) — receives the submitted referee detail form data
 *     (routed from doPost in nominatev2.gs), finds the referee row by token, enforces
 *     the deadline state, writes all referee-provided columns (I, J, M-P, V-Y), sets
 *     Status to 'Confirmed', and writes SubmittedAt. Also sets LateFlag = 'Y' only on
 *     a first-time submission during the grace period (not on edits).
 *
 * COLUMN REFERENCES USED (1-based for getRange; 0-based for array indexing):
 *   I  = col  9 (0-based  8)  Phone
 *   J  = col 10 (0-based  9)  Age
 *   M  = col 13 (0-based 12)  Availability
 *   N  = col 14 (0-based 13)  Gender
 *   O  = col 15 (0-based 14)  Hotel Weekend 1
 *   P  = col 16 (0-based 15)  Hotel Weekend 2
 *   R  = col 18 (0-based 17)  Token (scan target)
 *   S  = col 19 (0-based 18)  Status (set to 'Confirmed' on submit)
 *   U  = col 21 (0-based 20)  SubmittedAt (written by system)
 *   V  = col 22 (0-based 21)  RefWeekend1
 *   W  = col 23 (0-based 22)  RefWeekend2
 *   X  = col 24 (0-based 23)  LateFlag (written by system)
 *   Y  = col 25 (0-based 24)  RefNotes
 *   AB = col 28 (0-based 27)  Parent/Guardian Email (Phase 5.1 — minor referees only)
 *
 *   Also reads (0-based):
 *   B = col  2 (0-based  1)  DRA Name
 *   C = col  3 (0-based  2)  DRA Email
 *   F = col  6 (0-based  5)  First Name
 *   G = col  7 (0-based  6)  Last Name
 *   H = col  8 (0-based  7)  Referee Email
 *
 * NOTE: doGet is defined HERE. doPost routing for submitDetails and markSent is in nominatev2.gs.
 * NOTE: _jsonResponse helper is defined in nominatev2.gs and shared across files
 *       because GAS compiles all .gs files in the project together.
 * NOTE: _handleGetAllNominees is defined in adminemail.gs and callable from doGet here.
 *
 * COLUMN CONSTANTS IN THIS FILE:
 *   Declares Phase 3 and Phase 5.1 columns not already in nominatev2.gs.
 *   COL_TOKEN (18), COL_STATUS (19), COL_FIRST_NAME (6), COL_LAST_NAME (7),
 *   COL_REF_EMAIL (8), COL_DRA_NAME (2), COL_DRA_EMAIL (3) are declared in
 *   nominatev2.gs and accessible here without redeclaration.
 *   COL_PARENT_EMAIL (28) — Phase 5.1, parent/guardian email for minor referees.
 */


// ---------------------------------------------------------------------------
// COLUMN INDEX CONSTANTS — Phase 3 columns only
// (COL_TOKEN, COL_STATUS, COL_FIRST_NAME, COL_LAST_NAME, COL_REF_EMAIL,
//  COL_DRA_NAME, COL_DRA_EMAIL are declared in nominatev2.gs)
// Full A-Z reference: .planning/COLUMN-MAP.md
// ---------------------------------------------------------------------------

var COL_PHONE        =  9; // I
var COL_AGE          = 10; // J
var COL_AVAILABILITY = 13; // M
var COL_GENDER       = 14; // N
var COL_HOTEL_WKD1   = 15; // O
var COL_HOTEL_WKD2   = 16; // P
var COL_SUBMITTED_AT = 21; // U
var COL_REF_WEEKEND1 = 22; // V
var COL_REF_WEEKEND2 = 23; // W
var COL_LATE_FLAG    = 24; // X
var COL_REF_NOTES    = 25; // Y
var COL_PARENT_EMAIL = 28; // AB — Parent/Guardian Email (Phase 5.1 — minor referees only)


// ---------------------------------------------------------------------------
// _getDeadlineState — Shared Deadline Logic
// ---------------------------------------------------------------------------

/**
 * Reads the ConfirmationDeadline named range from the spreadsheet and returns
 * the current deadline state and a formatted display string.
 *
 * Returns { state: 'open' | 'late' | 'hard_closed', display: 'April 30, 2026' }.
 * If the named range is missing or the cell has no valid date, returns state='open'
 * and display='' — the form works even if the assignor hasn't set a deadline yet.
 *
 * Applies end-of-day (23:59:59.999) to the deadline date before comparing so that
 * a referee submitting at 11pm on the deadline day is not incorrectly marked late.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {{ state: string, display: string }}
 */
function _getDeadlineState(ss) {
  var deadlineRange = ss.getRangeByName('ConfirmationDeadline');

  if (!deadlineRange) {
    return { state: 'open', display: '' };
  }

  var deadlineVal = deadlineRange.getValue();

  if (!(deadlineVal instanceof Date) || isNaN(deadlineVal.getTime())) {
    return { state: 'open', display: '' };
  }

  // Use end-of-day so submitting at 11pm on the deadline day is not late.
  deadlineVal.setHours(23, 59, 59, 999);

  var now          = new Date();
  var hardClose    = new Date(deadlineVal.getTime() + 3 * 24 * 60 * 60 * 1000); // +3 days
  var display      = Utilities.formatDate(deadlineVal, Session.getScriptTimeZone(), 'MMMM d, yyyy');
  var state;

  if (now > hardClose) {
    state = 'hard_closed';
  } else if (now > deadlineVal) {
    state = 'late';
  } else {
    state = 'open';
  }

  return { state: state, display: display };
}


// ---------------------------------------------------------------------------
// _findRowByToken — Token Scan Helper
// ---------------------------------------------------------------------------

/**
 * Scans column R (COL_TOKEN = 18) in a batch read and returns the 1-based
 * row number matching the given token string.
 *
 * Returns -1 if the sheet has no data rows or no matching token.
 * Never calls getValue() in a loop — reads all tokens in one API call.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string} token — the token to find (already trimmed by caller)
 * @returns {number} 1-based row number, or -1 if not found
 */
function _findRowByToken(sheet, token) {
  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return -1; // No data rows
  }

  var dataRowCount = lastRow - 1;
  // Read all tokens in column R from row 2 to lastRow in a single API call.
  var tokens = sheet.getRange(2, COL_TOKEN, dataRowCount, 1).getValues();

  for (var i = 0; i < tokens.length; i++) {
    if (String(tokens[i][0]).trim() === token) {
      return i + 2; // +2: 1-based row index + skip header row
    }
  }

  return -1;
}


// ---------------------------------------------------------------------------
// doGet — Web App Entry Point (HTTP GET)
// ---------------------------------------------------------------------------

/**
 * Handles all incoming GET requests.
 *
 * Routes based on the optional action query parameter:
 *   - action=getAllNominees → _handleGetAllNominees() (Phase 4, adminemail.gs)
 *   - action=getDRANominees → _handleGetDRANominees(draName) (Phase 7, adminemail.gs)
 *   - no action / any other value → token-based referee detail lookup (Phase 3, below)
 *
 * For the token-based path, extracts the token from the URL query string (?token=...)
 * and delegates to _handleGetDetails for the full data retrieval and response assembly.
 *
 * On any unexpected server error, logs the error via Logger.log and returns
 * a generic server_error response — the raw error message is NOT exposed to
 * the client (could contain row numbers or other internal details).
 *
 * @param {Object} e — Apps Script event object with e.parameter.action and/or e.parameter.token
 * @returns {ContentService.TextOutput} JSON response
 */
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';

    // Phase 4: Admin page — return all nominees as JSON.
    // _handleGetAllNominees is defined in adminemail.gs (same GAS project scope).
    if (action === 'getAllNominees') {
      return _handleGetAllNominees();
    }

    // Phase 7: DRA nominee view — return nominees for a specific DRA.
    // _handleGetDRANominees is defined in adminemail.gs (same GAS project scope).
    if (action === 'getDRANominees') {
      var draName = (e.parameter.draName || '').trim();
      return _handleGetDRANominees(draName);
    }

    // Phase 3: Referee detail form — token-based lookup (existing behavior).
    var token = (e && e.parameter && e.parameter.token)
      ? e.parameter.token.trim()
      : '';

    if (!token) {
      return _jsonResponse({
        ok: false,
        error: 'missing_token',
        message: 'No token provided.'
      });
    }

    return _handleGetDetails(token);

  } catch (err) {
    Logger.log('doGet error: ' + err.message);
    return _jsonResponse({
      ok: false,
      error: 'server_error',
      message: 'An internal error occurred.'
    });
  }
}


// ---------------------------------------------------------------------------
// _handleGetDetails — Token Lookup and Data Assembly
// ---------------------------------------------------------------------------

/**
 * Looks up the referee row by token and returns all data needed to populate
 * the referee detail form on page load.
 *
 * Steps:
 *   1. Find the referee's row by scanning column R (via _findRowByToken)
 *   2. Read the full row (columns A-AB = 28 columns) in one API call
 *   3. Determine deadline state (via _getDeadlineState)
 *   4. Read tournament constants from PropertiesService
 *   5. Return a JSON response with all referee, DRA, tournament, and prior-submission data
 *
 * All field values are cast to String with a fallback to '' to ensure the
 * frontend always receives strings (not null/false/Date objects).
 *
 * @param {string} token — trimmed token extracted from URL by doGet
 * @returns {ContentService.TextOutput} JSON response
 */
function _handleGetDetails(token) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();

  // Token lookup
  var rowNum = _findRowByToken(sheet, token);

  if (rowNum === -1) {
    return _jsonResponse({
      ok: false,
      error: 'invalid_token',
      message: 'Token not found.'
    });
  }

  // Read full row — columns A through AB (28 columns), result is a 0-based array.
  var rowData = sheet.getRange(rowNum, 1, 1, 28).getValues()[0];

  // Deadline state
  var deadline = _getDeadlineState(ss);

  // Tournament constants
  var props = PropertiesService.getScriptProperties();

  return _jsonResponse({
    ok: true,

    // Deadline
    deadlineState:   deadline.state,   // 'open' | 'late' | 'hard_closed'
    deadlineDisplay: deadline.display, // e.g., 'April 30, 2026' or ''

    // Referee identity (DRA-provided at nomination time)
    firstName:    String(rowData[5]  || ''), // F (0-based index 5)
    lastName:     String(rowData[6]  || ''), // G (0-based index 6)
    refEmail:     String(rowData[7]  || ''), // H (0-based index 7)

    // DRA context
    draName:      String(rowData[1]  || ''), // B (0-based index 1)
    draEmail:     String(rowData[2]  || ''), // C (0-based index 2)

    // Status and prior submission marker
    status:       String(rowData[18] || ''), // S (0-based index 18)
    submittedAt:  rowData[20] ? String(rowData[20]) : '', // U (0-based index 20)

    // Referee-provided fields — blank on first visit, populated on return visits
    phone:        String(rowData[8]  || ''), // I (0-based index 8)
    age:          String(rowData[9]  || ''), // J (0-based index 9)
    availability: String(rowData[12] || ''), // M (0-based index 12)
    gender:       String(rowData[13] || ''), // N (0-based index 13)
    hotelWkd1:    String(rowData[14] || ''), // O (0-based index 14)
    hotelWkd2:    String(rowData[15] || ''), // P (0-based index 15)
    refWeekend1:  String(rowData[21] || ''), // V (0-based index 21)
    refWeekend2:  String(rowData[22] || ''), // W (0-based index 22)
    lateFlag:     String(rowData[23] || ''), // X (0-based index 23)
    refNotes:     String(rowData[24] || ''), // Y (0-based index 24)
    parentEmail:  String(rowData[27] || ''), // AB (0-based index 27)

    // Tournament context (set by setTournamentConstants() in nominatev2.gs)
    weekend1Dates:  props.getProperty('WEEKEND_1_DATES') || '',
    weekend2Dates:  props.getProperty('WEEKEND_2_DATES') || '',
    assignorEmail:  props.getProperty('ASSIGNOR_EMAIL')  || ''
  });
}


// ---------------------------------------------------------------------------
// _handleSubmitDetails — Referee Form Submission Handler
// ---------------------------------------------------------------------------

/**
 * Writes referee-provided detail form fields to the referee's sheet row.
 * Called from doPost in nominatev2.gs when payload.action === 'submitDetails'.
 *
 * Steps:
 *   1. Acquire script lock (15-second timeout) to serialize concurrent writes
 *   2. Check deadline state — reject with hard_closed error if past grace period
 *   3. Find the referee row by token scan
 *   4. Read existing SubmittedAt to determine if this is a first submission or an edit
 *   5. Read existing LateFlag to preserve it on edits
 *   6. Write referee-provided columns: I, J (single cells), M-P (one 4-col range), V-Y (one 4-col range)
 *   7. Write system columns: Status = 'Confirmed' (S), SubmittedAt = new Date() (U)
 *   8. Return { ok: true, lateFlag: 'Y' | null }
 *
 * LateFlag logic (column X):
 *   - 'Y' only when deadlineState === 'late' AND this is the FIRST submission (SubmittedAt was blank)
 *   - If this is an EDIT during grace period, preserve the existing LateFlag value (don't overwrite)
 *   - If deadlineState === 'open', LateFlag is always '' (never set)
 *
 * @param {Object} payload — parsed JSON from doPost; must include token and all detail fields
 * @returns {ContentService.TextOutput} JSON response
 */
function _handleSubmitDetails(payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000); // Wait up to 15 seconds; throws if can't acquire

  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();

    // Step 1: Deadline check — reject hard-closed submissions before any writes.
    var deadline = _getDeadlineState(ss);

    if (deadline.state === 'hard_closed') {
      return _jsonResponse({
        ok: false,
        error: 'hard_closed',
        message: 'Submissions are closed.'
      });
    }

    // Step 2: Token lookup — find the referee's row.
    var token  = (payload.token || '').trim();
    var rowNum = _findRowByToken(sheet, token);

    if (rowNum === -1) {
      return _jsonResponse({
        ok: false,
        error: 'invalid_token',
        message: 'Token not found.'
      });
    }

    // Step 3: Determine first-submission vs. edit.
    //   SubmittedAt (column U = COL_SUBMITTED_AT = 21) is blank on first visit.
    var existingSubmittedAt = sheet.getRange(rowNum, COL_SUBMITTED_AT).getValue();
    var isFirstSubmission   = !existingSubmittedAt;

    // Step 4: Determine LateFlag value.
    //   Only set to 'Y' on the FIRST submission during the grace period.
    //   On edits: read and preserve the existing LateFlag value (column X).
    var existingLateFlag = isFirstSubmission
      ? ''
      : (sheet.getRange(rowNum, COL_LATE_FLAG).getValue() || '');

    var lateFlag = (deadline.state === 'late' && isFirstSubmission) ? 'Y' : existingLateFlag;

    // Step 5: Write referee-provided single-cell columns.
    sheet.getRange(rowNum, COL_PHONE).setValue(payload.phone || ''); // I
    sheet.getRange(rowNum, COL_AGE).setValue(payload.age   || ''); // J

    // Step 6: Write M-P as one range (Availability, Gender, Hotel Wkd1, Hotel Wkd2).
    sheet.getRange(rowNum, COL_AVAILABILITY, 1, 4).setValues([[
      payload.availability || '', // M
      payload.gender       || '', // N
      payload.hotelWkd1    || '', // O
      payload.hotelWkd2    || ''  // P
    ]]);

    // Step 7: Write V-Y as one range (RefWeekend1, RefWeekend2, LateFlag, RefNotes).
    //   LateFlag (X = col 24) is the 3rd cell in this range — system-written, not from payload.
    sheet.getRange(rowNum, COL_REF_WEEKEND1, 1, 4).setValues([[
      payload.refWeekend1 || '', // V
      payload.refWeekend2 || '', // W
      lateFlag,                  // X — system-determined (see LateFlag logic above)
      payload.refNotes    || ''  // Y
    ]]);

    // Step 8: Write system columns.
    sheet.getRange(rowNum, COL_STATUS).setValue('Confirmed'); // S
    sheet.getRange(rowNum, COL_SUBMITTED_AT).setValue(new Date()); // U

    // Step 9: Write parent/guardian email (column AB) — only present for minors.
    sheet.getRange(rowNum, COL_PARENT_EMAIL).setValue(payload.parentEmail || '');

    Logger.log('_handleSubmitDetails: Row ' + rowNum + ' updated. isFirstSubmission=' + isFirstSubmission + ', deadlineState=' + deadline.state + ', lateFlag=' + lateFlag);

    return _jsonResponse({
      ok: true,
      lateFlag: lateFlag || null
    });

  } finally {
    lock.releaseLock();
  }
}
