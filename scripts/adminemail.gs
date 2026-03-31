/**
 * adminemail.gs
 *
 * Phase 4 + Phase 7: Email Admin Page and DRA Nominee View — backend handlers.
 * Paste this file into the same Apps Script project as nominatev2.gs and refdetails.gs.
 *
 * WHAT THIS SCRIPT DOES:
 *   _handleGetAllNominees() — returns all nominee rows as a JSON array, plus tournament
 *     properties (assignorEmail, weekend1Dates, weekend2Dates, refFormUrl, deadlineDisplay)
 *     so the admin page can build mailto bodies without hardcoding tournament details.
 *
 *   _handleMarkSent(payload) — marks a referee's Status as 'Sent' and writes the SentAt
 *     timestamp (column T). Idempotent: if the referee is already Sent or Confirmed, returns
 *     ok:true without overwriting. Uses LockService to serialize concurrent writes.
 *
 *   _handleGetDRANominees(draName) — Phase 7: returns nominees filtered by DRA name with
 *     simplified status labels (Responded/Pending). When draName is empty, returns distinct
 *     DRA names for the dropdown. Excludes email, token, and admin-only fields.
 *
 * COLUMN REFERENCES USED (1-based for getRange; 0-based for array indexing):
 *   B  = col  2 (0-based  1)  DRA Name
 *   F  = col  6 (0-based  5)  First Name
 *   G  = col  7 (0-based  6)  Last Name
 *   H  = col  8 (0-based  7)  Referee Email
 *   J  = col 10 (0-based  9)  Age
 *   R  = col 18 (0-based 17)  Token (lookup key)
 *   S  = col 19 (0-based 18)  Status (written to 'Sent')
 *   T  = col 20 (0-based 19)  SentAt (written by _handleMarkSent)
 *   V  = col 22 (0-based 21)  RefWeekend1
 *   W  = col 23 (0-based 22)  RefWeekend2
 *   AB = col 28 (0-based 27)  Parent/Guardian Email (Phase 5.1 — minor referees only)
 *
 * NOTE: This file does NOT declare doGet or doPost.
 *   doGet routing for action=getAllNominees is in refdetails.gs.
 *   doPost routing for action=markSent is in nominatev2.gs.
 *   All functions here are callable from those entry points because GAS compiles
 *   all .gs files in a project into a single shared scope.
 *
 * COLUMN CONSTANTS IN THIS FILE:
 *   Declares only COL_SENT_AT (20) — the only Phase 4 column not declared elsewhere.
 *   COL_TOKEN (18), COL_STATUS (19), COL_FIRST_NAME (6), COL_LAST_NAME (7),
 *   COL_REF_EMAIL (8), COL_DRA_NAME (2) are declared in nominatev2.gs and
 *   accessible here without redeclaration.
 *   _findRowByToken, _getDeadlineState, and _jsonResponse are defined in
 *   refdetails.gs / nominatev2.gs and callable from this file via shared scope.
 *
 * Full A-Z column reference: .planning/COLUMN-MAP.md
 */


// ---------------------------------------------------------------------------
// COLUMN INDEX CONSTANTS — Phase 4 columns only
// (COL_TOKEN, COL_STATUS, COL_FIRST_NAME, COL_LAST_NAME, COL_REF_EMAIL,
//  COL_DRA_NAME are declared in nominatev2.gs)
// Full A-Z reference: .planning/COLUMN-MAP.md
// ---------------------------------------------------------------------------

var COL_SENT_AT = 20; // T — timestamp written when Status is set to 'Sent'


// ---------------------------------------------------------------------------
// _handleGetAllNominees — Return All Nominee Rows as JSON
// ---------------------------------------------------------------------------

/**
 * Returns all nominee rows from the active sheet as a JSON array, plus
 * tournament configuration properties so the admin page can build mailto
 * bodies and display weekend dates without hardcoding them.
 *
 * Steps:
 *   1. Get active spreadsheet and sheet
 *   2. If no data rows, return empty nominees array immediately
 *   3. Read all data rows (A through AB = 28 columns) in a single API call
 *   4. Read tournament properties from PropertiesService
 *   5. Read deadline display string via _getDeadlineState (from refdetails.gs)
 *   6. Map each row to a flat JSON object using 0-based array indices
 *   7. Return { ok: true, nominees: [...], props: { ... } }
 *
 * All field values are cast to String with a '|| ""' fallback so the frontend
 * always receives strings (never null, false, or Date objects).
 *
 * @returns {ContentService.TextOutput} JSON response with nominees array and props
 */
function _handleGetAllNominees() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();

  var lastRow = sheet.getLastRow();

  // No data rows — return empty array immediately (header row is row 1).
  if (lastRow <= 1) {
    return _jsonResponse({ ok: true, nominees: [], props: {} });
  }

  // Read all data rows A through AB (28 columns) in a single API call.
  // Result is a 2D array: rows[i][j] where i=row index, j=0-based column index.
  var dataRowCount = lastRow - 1;
  var rows = sheet.getRange(2, 1, dataRowCount, 28).getValues();

  // Read tournament properties for the admin page mailto builder.
  var scriptProps   = PropertiesService.getScriptProperties();
  var assignorEmail = scriptProps.getProperty('ASSIGNOR_EMAIL')  || '';
  var weekend1Dates = scriptProps.getProperty('WEEKEND_1_DATES') || '';
  var weekend2Dates = scriptProps.getProperty('WEEKEND_2_DATES') || '';
  var refFormUrl    = scriptProps.getProperty('REF_FORM_URL')    || '';

  // Read deadline display string (state.display only — admin page is read-only).
  var deadlineInfo    = _getDeadlineState(ss);
  var deadlineDisplay = deadlineInfo.display || '';

  // Map each sheet row to a nominee object.
  // Column indices below are 0-based (1-based value = index + 1):
  //   r[1]  = B  (col  2) DRA Name
  //   r[5]  = F  (col  6) First Name
  //   r[6]  = G  (col  7) Last Name
  //   r[7]  = H  (col  8) Referee Email
  //   r[9]  = J  (col 10) Age
  //   r[17] = R  (col 18) Token
  //   r[18] = S  (col 19) Status
  //   r[21] = V  (col 22) RefWeekend1
  //   r[22] = W  (col 23) RefWeekend2
  //   r[27] = AB (col 28) Parent/Guardian Email
  var nominees = rows.map(function(r) {
    return {
      draName:     String(r[1]  || ''), // B  (0-based index  1)
      firstName:   String(r[5]  || ''), // F  (0-based index  5)
      lastName:    String(r[6]  || ''), // G  (0-based index  6)
      refEmail:    String(r[7]  || ''), // H  (0-based index  7)
      token:       String(r[17] || ''), // R  (0-based index 17)
      status:      String(r[18] || ''), // S  (0-based index 18)
      refWeekend1: String(r[21] || ''), // V  (0-based index 21)
      refWeekend2: String(r[22] || ''), // W  (0-based index 22)
      age:         String(r[9]  || ''), // J  (0-based index  9)
      parentEmail: String(r[27] || '')  // AB (0-based index 27)
    };
  });

  Logger.log('_handleGetAllNominees: Returning ' + nominees.length + ' nominee(s).');

  return _jsonResponse({
    ok: true,
    nominees: nominees,
    props: {
      assignorEmail:   assignorEmail,
      weekend1Dates:   weekend1Dates,
      weekend2Dates:   weekend2Dates,
      refFormUrl:      refFormUrl,
      deadlineDisplay: deadlineDisplay
    }
  });
}


// ---------------------------------------------------------------------------
// _handleMarkSent — Mark Referee Status as Sent
// ---------------------------------------------------------------------------

/**
 * Sets a referee's Status (column S) to 'Sent' and writes the current
 * timestamp to SentAt (column T = COL_SENT_AT = 20).
 *
 * Idempotency: If the referee's current status is anything other than
 * 'Not Sent' (i.e., already 'Sent' or 'Confirmed'), the function returns
 * { ok: true, alreadyMarked: true } without overwriting any cell values.
 * This ensures a double-click or page-reload on the admin page cannot
 * overwrite a 'Confirmed' status back to 'Sent'.
 *
 * Steps:
 *   1. Acquire script lock (15-second timeout) to serialize concurrent writes
 *   2. Validate token: trim, check non-empty
 *   3. Call _findRowByToken to locate the referee's row (from refdetails.gs)
 *   4. Read current status from column S
 *   5. Idempotency check: if status !== 'Not Sent', return early without writing
 *   6. Write Status = 'Sent' to column S (COL_STATUS = 19)
 *   7. Write SentAt = new Date() to column T (COL_SENT_AT = 20)
 *   8. Return { ok: true, alreadyMarked: false }
 *   9. Release lock in finally block (always runs)
 *
 * @param {Object} payload — parsed JSON from doPost; must include payload.token
 * @returns {ContentService.TextOutput} JSON response
 */
function _handleMarkSent(payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000); // Wait up to 15 seconds; throws if can't acquire

  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();

    // Step 1: Validate token.
    var token = (payload.token || '').trim();

    if (!token) {
      return _jsonResponse({
        ok: false,
        error: 'missing_token',
        message: 'No token provided.'
      });
    }

    // Step 2: Token lookup — find the referee's row number.
    // _findRowByToken is defined in refdetails.gs and available in shared GAS scope.
    var rowNum = _findRowByToken(sheet, token);

    if (rowNum === -1) {
      return _jsonResponse({
        ok: false,
        error: 'invalid_token',
        message: 'Token not found.'
      });
    }

    // Step 3: Read current status from column S (COL_STATUS = 19, 1-based).
    var currentStatus = sheet.getRange(rowNum, COL_STATUS).getValue();

    // Step 4: Idempotency check.
    // Only update if status is exactly 'Not Sent'. A referee who is already
    // 'Sent' or 'Confirmed' must not have their status overwritten.
    if (currentStatus !== 'Not Sent') {
      Logger.log('_handleMarkSent: Row ' + rowNum + ' already has status "' + currentStatus + '" — skipping write.');
      return _jsonResponse({ ok: true, alreadyMarked: true });
    }

    // Step 5: Write Status = 'Sent' to column S (COL_STATUS = 19).
    sheet.getRange(rowNum, COL_STATUS).setValue('Sent');

    // Step 6: Write SentAt = current timestamp to column T (COL_SENT_AT = 20).
    sheet.getRange(rowNum, COL_SENT_AT).setValue(new Date());

    Logger.log('_handleMarkSent: Row ' + rowNum + ' updated — Status=Sent, SentAt written.');

    return _jsonResponse({ ok: true, alreadyMarked: false });

  } finally {
    lock.releaseLock();
  }
}


// ---------------------------------------------------------------------------
// _handleGetDRANominees — Return Nominees for a Specific DRA (Phase 7)
// ---------------------------------------------------------------------------

/**
 * Returns nominee data for the DRA nominee view page.
 *
 * Two modes based on the draName parameter:
 *   - draName empty/null → returns sorted distinct DRA names from column B
 *   - draName provided   → returns filtered nominees with simplified status
 *
 * Simplified status mapping (DRA-facing):
 *   'Confirmed' → 'Responded'
 *   anything else ('Not Sent', 'Sent', blank) → 'Pending'
 *
 * Returned nominee fields (DRA-relevant only — no email, token, or admin fields):
 *   firstName (F/5), lastName (G/6), status (simplified), phone (I/8),
 *   age (J/9), availability (M/12), gender (N/13), hotelWkd1 (O/14),
 *   hotelWkd2 (P/15), refWeekend1 (V/21), refWeekend2 (W/22), refNotes (Y/24)
 *
 * @param {string} draName — DRA name to filter by, or empty for name list
 * @returns {ContentService.TextOutput} JSON response
 */
function _handleGetDRANominees(draName) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var lastRow = sheet.getLastRow();

  // --- Mode 1: Return distinct DRA names ---
  if (!draName) {
    if (lastRow <= 1) {
      return _jsonResponse({ ok: true, draNames: [] });
    }

    var dataRowCount = lastRow - 1;
    var draCol = sheet.getRange(2, COL_DRA_NAME, dataRowCount, 1).getValues();
    var nameSet = {};
    for (var i = 0; i < draCol.length; i++) {
      var name = String(draCol[i][0] || '').trim();
      if (name) nameSet[name] = true;
    }
    var draNames = Object.keys(nameSet).sort();

    Logger.log('_handleGetDRANominees: Returning ' + draNames.length + ' distinct DRA name(s).');
    return _jsonResponse({ ok: true, draNames: draNames });
  }

  // --- Mode 2: Return filtered nominees for a specific DRA ---
  if (lastRow <= 1) {
    return _jsonResponse({ ok: true, nominees: [], counts: { responded: 0, pending: 0 } });
  }

  var dataRowCount = lastRow - 1;
  var rows = sheet.getRange(2, 1, dataRowCount, 28).getValues();

  var nominees = [];
  var responded = 0;
  var pending = 0;

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r[1] || '').trim() !== draName) continue;

    var rawStatus = String(r[18] || '');
    var status = (rawStatus === 'Confirmed') ? 'Responded' : 'Pending';

    if (status === 'Responded') responded++;
    else pending++;

    nominees.push({
      firstName:    String(r[5]  || ''),
      lastName:     String(r[6]  || ''),
      status:       status,
      phone:        String(r[8]  || ''),
      age:          String(r[9]  || ''),
      availability: String(r[12] || ''),
      gender:       String(r[13] || ''),
      hotelWkd1:    String(r[14] || ''),
      hotelWkd2:    String(r[15] || ''),
      refWeekend1:  String(r[21] || ''),
      refWeekend2:  String(r[22] || ''),
      refNotes:     String(r[24] || '')
    });
  }

  Logger.log('_handleGetDRANominees: Returning ' + nominees.length + ' nominee(s) for DRA "' + draName + '".');

  return _jsonResponse({
    ok: true,
    nominees: nominees,
    counts: { responded: responded, pending: pending }
  });
}
