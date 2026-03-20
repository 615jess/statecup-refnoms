/**
 * nominatev2.gs
 *
 * Phase 2: nominateV2 handler — paste into Apps Script editor alongside setup-schema-v2.gs
 *
 * WHAT THIS SCRIPT DOES:
 *   Handles DRA nomination form submissions via HTTP POST.
 *   For each submitted referee row:
 *     - If referee email is NEW to the sheet: appends a row with columns A-H, K-L, Q, R, S
 *       (I, J, M-P left blank for the referee to fill in Phase 3)
 *     - If referee email ALREADY EXISTS: updates only columns A-H, K-L, and Q
 *       (preserves I, J, M-P, R/Token, and S/Status — never overwrites referee or system data)
 *   Deduplicates within a single batch (same email appearing twice = one row)
 *   Uses LockService to serialize concurrent writes
 *
 * HOW TO USE:
 *   1. Paste this file into a new script file named "nominatev2" in the Apps Script editor
 *      (keep it alongside setup-schema-v2.gs in the same project)
 *   2. Run setTournamentConstants ONCE from the function dropdown to store config
 *   3. Deploy as a web app: Deploy > New deployment > Web app
 *      Execute as: Me | Who has access: Anyone
 *   4. Copy the /exec URL for use in the DRA form (Plan 02-02)
 *
 * COLUMN REFERENCE (1-based, for getRange):
 *   A =  1  Timestamp       — written by nominateV2 on every submission
 *   B =  2  DRA Name        — from DRA form
 *   C =  3  DRA Email       — from DRA form
 *   D =  4  District        — from DRA form
 *   E =  5  Referee #       — from DRA form (sequential, assigned by frontend)
 *   F =  6  First Name      — from DRA form
 *   G =  7  Last Name       — from DRA form
 *   H =  8  Referee Email   — from DRA form (dedup key)
 *   I =  9  Phone            — referee fills in Phase 3, never touched here
 *   J = 10  Age              — referee fills in Phase 3, never touched here
 *   K = 11  Max Age as AR    — from DRA form
 *   L = 12  Max Age as Ref   — from DRA form
 *   M-P 13-16 Referee detail fields — written by referee form (Phase 3), never touched here
 *   Q = 17  DRA Notes       — from DRA form
 *   R = 18  Token           — UUID generated at nomination time (new rows only, never updated)
 *   S = 19  Status          — 'Not Sent' on initial creation (never updated here)
 *
 * NOTE: doGet is intentionally omitted — Phase 3 will add that separately.
 */


// ---------------------------------------------------------------------------
// COLUMN INDEX CONSTANTS (1-based, for use with getRange)
// Only the columns this script reads or writes are included.
// Full A-Z reference: .planning/COLUMN-MAP.md
// ---------------------------------------------------------------------------

var COL_TIMESTAMP    =  1; // A — written on every nominateV2 call
var COL_DRA_NAME     =  2; // B
var COL_DRA_EMAIL    =  3; // C
var COL_DISTRICT     =  4; // D
var COL_REF_NUMBER   =  5; // E
var COL_FIRST_NAME   =  6; // F
var COL_LAST_NAME    =  7; // G
var COL_REF_EMAIL    =  8; // H — dedup key
var COL_MAX_AGE_AR   = 11; // K — DRA-provided max age as AR
var COL_MAX_AGE_REF  = 12; // L — DRA-provided max age as referee
var COL_DRA_NOTES    = 17; // Q
var COL_TOKEN        = 18; // R — UUID, set on append only
var COL_STATUS       = 19; // S — 'Not Sent' on append only


// ---------------------------------------------------------------------------
// doPost — Web App Entry Point
// ---------------------------------------------------------------------------

/**
 * Handles all incoming POST requests from the DRA nomination form.
 *
 * Expected payload shape (JSON string in e.postData.contents):
 *   {
 *     action: 'nominateV2',
 *     website: '',          // honeypot — if non-empty, silently ignore
 *     rows: [
 *       {
 *         dra: 'DRA Name',
 *         dra_email: 'dra@district.com',
 *         district: 'District Name',
 *         ref_num: 1,
 *         first: 'Jane',
 *         last: 'Smith',
 *         ref_email: 'jane@example.com',
 *         max_ar: 'U17',
 *         max_ref: 'U19',
 *         notes: 'Optional DRA notes'
 *       },
 *       ...
 *     ]
 *   }
 *
 * Returns JSON:
 *   { ok: true, results: [{ name: 'Jane Smith', status: 'new' | 'updated' }, ...] }
 *   { ok: false, error: '...' }
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);

    // Honeypot check — silently accept without writing any rows.
    // Bots that fill hidden fields are fooled into thinking submission succeeded.
    if (payload.website) {
      return _jsonResponse({ ok: true, results: [] });
    }

    if (payload.action === 'nominateV2') {
      return _handleNominateV2(payload.rows);
    }

    return _jsonResponse({ ok: false, error: 'Unknown action: ' + payload.action });

  } catch (err) {
    Logger.log('doPost error: ' + err.message);
    return _jsonResponse({ ok: false, error: err.message });
  }
}


// ---------------------------------------------------------------------------
// _handleNominateV2 — Core Logic
// ---------------------------------------------------------------------------

/**
 * Processes an array of referee nomination rows from a single DRA submission.
 *
 * Steps:
 *   1. Acquire script lock (15 second timeout) to serialize concurrent writes
 *   2. Get active spreadsheet and sheet
 *   3. Deduplicate within the submitted batch (last-wins for same email)
 *   4. Load existing email index from column H (email -> rowNumber map)
 *   5. For each deduped row:
 *      - If email exists in sheet: update columns A-H, K-L, and Q only
 *      - If email is new: generate UUID token, append full row, update local index
 *   6. Release lock (in finally — always runs)
 *   7. Return per-nominee new/updated status
 *
 * @param {Array} rows — array of referee row objects from the DRA form payload
 * @returns {ContentService.TextOutput} JSON response
 */
function _handleNominateV2(rows) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000); // Wait up to 15 seconds; throws if can't acquire

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();

    // Step 1: Deduplicate within this batch by referee email.
    // If the DRA accidentally entered the same referee twice, last entry wins.
    // Rows with no email at all are always passed through (no dedup key).
    var deduped = _deduplicateBatch(rows);

    // Step 2: Load existing referee email -> rowNumber map from column H.
    var emailIndex = _loadEmailIndex(sheet);

    // Step 3: Process each deduped row.
    var results = [];

    for (var i = 0; i < deduped.length; i++) {
      var row = deduped[i];
      var email = (row.ref_email || '').trim().toLowerCase();

      if (email && emailIndex.hasOwnProperty(email)) {
        // Existing referee — update DRA columns only (A-H and Q).
        // Preserves referee-filled columns I-P, token R, and status S.
        var existingRowNum = emailIndex[email];
        _updateDraColumns(sheet, existingRowNum, row);
        results.push({ name: row.first + ' ' + row.last, status: 'updated' });
        Logger.log('Updated row ' + existingRowNum + ' for: ' + email);

      } else {
        // New referee — generate UUID token and append a full row.
        var token = Utilities.getUuid();
        _appendNewRow(sheet, row, token);

        // Update local index so a second row with the same email in THIS batch
        // (which shouldn't happen after dedup but is defensive) doesn't append twice.
        if (email) {
          emailIndex[email] = sheet.getLastRow();
        }

        results.push({ name: row.first + ' ' + row.last, status: 'new' });
        Logger.log('Appended new row for: ' + email);
      }
    }

    return _jsonResponse({ ok: true, results: results });

  } finally {
    lock.releaseLock();
  }
}


// ---------------------------------------------------------------------------
// _deduplicateBatch — Within-Batch Deduplication
// ---------------------------------------------------------------------------

/**
 * Deduplicates an array of rows by referee email within a single batch.
 * Last occurrence of a given email wins (DRA's most recent entry takes effect).
 * Rows without a ref_email are always included (no dedup key).
 *
 * @param {Array} rows — raw rows from payload
 * @returns {Array} deduped rows, preserving last-wins order
 */
function _deduplicateBatch(rows) {
  var seen = {};     // normalized email -> index in dedupedList
  var dedupedList = [];

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var email = (row.ref_email || '').trim().toLowerCase();

    if (!email) {
      // No email — always append (cannot dedup without a key)
      dedupedList.push(row);
    } else if (seen.hasOwnProperty(email)) {
      // Duplicate email in this batch — overwrite with latest entry
      dedupedList[seen[email]] = row;
    } else {
      // First occurrence of this email
      seen[email] = dedupedList.length;
      dedupedList.push(row);
    }
  }

  return dedupedList;
}


// ---------------------------------------------------------------------------
// _loadEmailIndex — Build Email-to-RowNumber Map
// ---------------------------------------------------------------------------

/**
 * Reads column H (Referee Email) from all data rows and returns a map
 * of { normalizedEmail: rowNumber } for efficient lookup.
 *
 * Returns an empty object if the sheet has only a header row (no data).
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {Object} email -> 1-based row number in the sheet
 */
function _loadEmailIndex(sheet) {
  var index = {};
  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    Logger.log('_loadEmailIndex: No data rows (lastRow = ' + lastRow + '). Returning empty index.');
    return index;
  }

  var dataRowCount = lastRow - 1;
  // Read column H only (COL_REF_EMAIL), rows 2 through lastRow
  var emailValues = sheet.getRange(2, COL_REF_EMAIL, dataRowCount, 1).getValues();

  for (var i = 0; i < emailValues.length; i++) {
    var rawEmail = emailValues[i][0];
    if (rawEmail) {
      var normalized = rawEmail.toString().trim().toLowerCase();
      if (normalized) {
        index[normalized] = i + 2; // +2 because data starts at row 2
      }
    }
  }

  Logger.log('_loadEmailIndex: Loaded ' + Object.keys(index).length + ' existing email(s) from ' + dataRowCount + ' data row(s).');
  return index;
}


// ---------------------------------------------------------------------------
// _updateDraColumns — Update Existing Row (DRA Columns Only)
// ---------------------------------------------------------------------------

/**
 * Updates columns A-H, K-L, and Q for an existing referee row.
 * NEVER modifies columns I, J, M-P (referee details), R (token), or S (status).
 *
 * Uses three range writes:
 *   1. Columns A-H (8 columns) as a single range for efficiency
 *   2. Columns K-L (2 columns) for DRA-provided max age values
 *   3. Column Q (DRA Notes) as a separate single-cell write
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} rowNum — 1-based row number of the existing referee row
 * @param {Object} row — referee data object from the DRA form payload
 */
function _updateDraColumns(sheet, rowNum, row) {
  // Build the 8-column values array for columns A-H
  var draValues = [[
    new Date(),                            // A: Timestamp
    row.dra        || '',                  // B: DRA Name
    row.dra_email  || '',                  // C: DRA Email
    row.district   || '',                  // D: District
    row.ref_num    || '',                  // E: Referee # (assigned by frontend)
    row.first      || '',                  // F: First Name
    row.last       || '',                  // G: Last Name
    row.ref_email  || ''                   // H: Referee Email
  ]];

  // Write A-H as a single 8-column range (COL_TIMESTAMP = 1, width = 8)
  sheet.getRange(rowNum, COL_TIMESTAMP, 1, 8).setValues(draValues);

  // Write K-L (Max Age as AR, Max Age as Ref) — DRA-provided, not adjacent to A-H
  sheet.getRange(rowNum, COL_MAX_AGE_AR, 1, 2).setValues([[
    row.max_ar  || '',                     // K: Max Age as AR
    row.max_ref || ''                      // L: Max Age as Ref
  ]]);

  // Write Q (DRA Notes) separately — it's column 17, not adjacent to A-H
  sheet.getRange(rowNum, COL_DRA_NOTES).setValue(row.notes || '');

  Logger.log('_updateDraColumns: Row ' + rowNum + ' updated (A-H, K-L, Q). I, J, M-P, R, S preserved.');
}


// ---------------------------------------------------------------------------
// _appendNewRow — Append Row for New Referee
// ---------------------------------------------------------------------------

/**
 * Appends a new row for a referee not yet in the sheet.
 * Writes a 19-element array covering columns A through S:
 *   A-H: DRA-provided data (columns 1-8)
 *   I-P: Empty strings (columns 9-16) — left for referee form in Phase 3
 *   Q:   DRA Notes (column 17)
 *   R:   UUID token (column 18) — generated by caller
 *   S:   'Not Sent' (column 19) — initial status
 *
 * Uses appendRow() which is safe with LockService because the lock
 * prevents concurrent appends from stepping on each other.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} row — referee data object from the DRA form payload
 * @param {string} token — UUID string generated by Utilities.getUuid()
 */
function _appendNewRow(sheet, row, token) {
  var newRow = [
    new Date(),                 // A (index 0):  Timestamp
    row.dra        || '',       // B (index 1):  DRA Name
    row.dra_email  || '',       // C (index 2):  DRA Email
    row.district   || '',       // D (index 3):  District
    row.ref_num    || '',       // E (index 4):  Referee # (sequential, from frontend)
    row.first      || '',       // F (index 5):  First Name
    row.last       || '',       // G (index 6):  Last Name
    row.ref_email  || '',       // H (index 7):  Referee Email (dedup key)
    '',                         // I (index 8):  Phone — referee fills in Phase 3
    '',                         // J (index 9):  Age — referee fills in Phase 3
    row.max_ar     || '',       // K (index 10): Max Age as AR — DRA-provided
    row.max_ref    || '',       // L (index 11): Max Age as Ref — DRA-provided
    '',                         // M (index 12): Availability — referee fills in Phase 3
    '',                         // N (index 13): Gender — referee fills in Phase 3
    '',                         // O (index 14): Hotel Weekend 1 — referee fills in Phase 3
    '',                         // P (index 15): Hotel Weekend 2 — referee fills in Phase 3
    row.notes      || '',       // Q (index 16): DRA Notes
    token,                      // R (index 17): Token — UUID, never updated after initial write
    'Not Sent'                  // S (index 18): Status — initial value
  ];

  sheet.appendRow(newRow);
  Logger.log('_appendNewRow: Appended new row for ' + (row.ref_email || '(no email)') + ' with token ' + token.substring(0, 8) + '...');
}


// ---------------------------------------------------------------------------
// _jsonResponse — Response Helper
// ---------------------------------------------------------------------------

/**
 * Wraps an object as a JSON ContentService response with correct MIME type.
 * All doPost return paths use this helper for consistent response format.
 *
 * @param {Object} obj — any JSON-serializable object
 * @returns {ContentService.TextOutput}
 */
function _jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


// ---------------------------------------------------------------------------
// setTournamentConstants — One-Time Setup (Run Manually from Editor)
// ---------------------------------------------------------------------------

/**
 * Stores tournament configuration in PropertiesService (Script Properties).
 * Run this ONCE from the Apps Script function dropdown after pasting this file.
 * These properties are read by future phases (Phase 3 ref form, Phase 4 admin page).
 *
 * HOW TO RUN:
 *   1. Open Extensions > Apps Script
 *   2. Select "setTournamentConstants" from the function dropdown
 *   3. Click Run
 *   4. Check Execution Log for "Tournament constants saved" confirmation
 *   5. Verify in Project Settings > Script Properties
 *
 * PROPERTIES STORED:
 *   ASSIGNOR_EMAIL     — Outlook address for mailto links (Phase 4)
 *   WEEKEND_1_DATES    — Display string for Weekend 1 of the tournament
 *   WEEKEND_2_DATES    — Display string for Weekend 2 of the tournament
 *   REF_FORM_URL       — URL of the referee details form (set after Phase 3 deployment)
 */
function setTournamentConstants() {
  var props = PropertiesService.getScriptProperties();

  props.setProperties({
    // VERIFY: confirm this is the correct assignor Outlook address before running
    'ASSIGNOR_EMAIL': 'jerickson@tnsoccer.org',

    'WEEKEND_1_DATES': 'May 16 & 17, 2026',
    'WEEKEND_2_DATES': 'May 23 & 24, 2026',

    // Set this after Phase 3 deployment — paste the /exec URL of the referee form
    'REF_FORM_URL': 'TBD'
  });

  Logger.log('Tournament constants saved.');
  Logger.log('  ASSIGNOR_EMAIL:  ' + props.getProperty('ASSIGNOR_EMAIL'));
  Logger.log('  WEEKEND_1_DATES: ' + props.getProperty('WEEKEND_1_DATES'));
  Logger.log('  WEEKEND_2_DATES: ' + props.getProperty('WEEKEND_2_DATES'));
  Logger.log('  REF_FORM_URL:    ' + props.getProperty('REF_FORM_URL'));
  Logger.log('  NOTE: Update REF_FORM_URL after Phase 3 deployment.');
}
