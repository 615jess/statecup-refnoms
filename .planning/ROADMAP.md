# Roadmap: State Cup Referee Confirmation System

## Overview

Build a token-based referee confirmation system on top of the existing nomination infrastructure. The sheet schema is established first so no code ever writes to undefined columns; the Apps Script backend is built and tested independently before any HTML exists; the confirmation page is constructed against verified endpoints; and the email admin page ships last because it embeds the finalized confirmation URL into mailto links that go to real referees.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Sheet Schema** - Append columns R-Y to the sheet and verify existing nominations still write correctly
- [ ] **Phase 2: Apps Script Backend** - Implement doGet (token lookup) and doPost (confirmation write) endpoints
- [ ] **Phase 3: Confirmation Page** - Build confirm.html with pre-fill, form controls, and all UI states
- [ ] **Phase 4: Email Admin Page** - Build the assignor-facing page with mailto links and token generation

## Phase Details

### Phase 1: Sheet Schema
**Goal**: The Google Sheet has all eight new columns (R-Y) appended in the correct positions, and the existing nomination form continues to write correctly to columns A-Q
**Depends on**: Nothing (first phase)
**Requirements**: SHEET-03, SHEET-04, SHEET-05
**Success Criteria** (what must be TRUE):
  1. Columns R-Y exist in the sheet with correct headers (Token, Status, SentAt, ConfirmedAt, RefWeekend1, RefWeekend2, RefHotel, RefNotes)
  2. Submitting the existing nomination form writes data to columns A-Q without error and without touching R-Y
  3. Column S (Status) displays "Not Sent" for all existing nomination rows
  4. No existing column indices in the Apps Script have shifted (verified by inspecting a test nomination submission)
**Plans**: 1 plan

Plans:
- [x] 01-01-PLAN.md -- Write setup and verification scripts for confirmation columns R-Y, Status backfill, dropdown validation, and ConfirmationDeadline named range

### Phase 2: Apps Script Backend
**Goal**: The Apps Script has working doGet and doPost endpoints — doGet returns referee JSON by token, doPost writes confirmation data to columns V-Y and updates status in column S — and existing nomination submissions are unaffected
**Depends on**: Phase 1
**Requirements**: TOKEN-01, TOKEN-02, TOKEN-03, SHEET-01, SHEET-02
**Success Criteria** (what must be TRUE):
  1. A GET request to the /exec URL with a valid token returns the referee's row data as JSON (name, weekends, hotel, status)
  2. A GET request with an invalid or missing token returns a JSON error response (not a 500 or HTML error page)
  3. A POST request with action=submitConfirmation and a valid token writes to columns V-Y and updates column S to "Confirmed" or "Declined"
  4. Re-submitting with the same token updates the existing row rather than appending a new row
  5. A test nomination submission (action=submitNomination) still writes correctly to columns A-Q without triggering the confirmation branch
**Plans**: TBD

Plans:
- [ ] 02-01: Implement doGet with token lookup, action routing, and JSON responses
- [ ] 02-02: Extend doPost with submitConfirmation branch, column writes, and LockService guard

### Phase 3: Confirmation Page
**Goal**: Referees who click a confirmation link can review their pre-filled nomination data, confirm or decline each weekend, update hotel needs, add notes, and submit — with the page working on mobile and matching the existing form's visual style
**Depends on**: Phase 2
**Requirements**: FORM-01, FORM-02, FORM-03, FORM-04, FORM-05, FORM-06, FORM-07, FORM-08, UX-01, UX-02, UX-03, UX-04
**Success Criteria** (what must be TRUE):
  1. Opening confirm.html?token=VALID_TOKEN shows a pre-filled form with the referee's name, nominated weekends, and hotel selections already populated
  2. A referee can independently confirm or decline each weekend, and the hotel field appears only for confirmed weekends
  3. Submitting the form shows a success screen that lists exactly what was confirmed (weekends, hotel, notes)
  4. Re-visiting the same confirmation link after submission shows the previously submitted data (supports edits)
  5. Opening confirm.html with an invalid token shows an error state with the assignor's contact email and a retry option
  6. The page renders without horizontal scrolling on a 375px-wide mobile screen and all interactive elements are at least 44px tall
**Plans**: TBD

Plans:
- [ ] 03-01: Build confirm.html static structure, CSS, and all UI states (loading, form, success, error, closed)
- [ ] 03-02: Implement fetch-on-load pre-fill, form submission POST, and mobile-responsive layout

### Phase 4: Email Admin Page
**Goal**: The assignor can open an admin page in a browser, see all nominated referees listed with mailto links, click a link to open Outlook with a pre-written confirmation email addressed to that referee, and send it — all without touching the Apps Script directly
**Depends on**: Phase 3
**Requirements**: EMAIL-01, EMAIL-02, EMAIL-03, EMAIL-04
**Success Criteria** (what must be TRUE):
  1. The admin page displays every nominated referee with their name, email, nominated weekends, and current confirmation status
  2. Clicking a referee's mailto link opens Outlook (or the default mail client) with the To field, Subject, and Body already filled in — including the referee's name, nominated weekends, and the correct confirm.html?token=... URL
  3. The email body contains the referee's name, the specific weekends they were nominated for, the confirmation link, and the assignor's contact information
  4. Accessing the admin page triggers token generation for any referee who does not yet have one, and sets their status to "Pending" in the sheet

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Sheet Schema | 1/1 | ✓ Complete | 2026-03-18 |
| 2. Apps Script Backend | 0/TBD | Not started | - |
| 3. Confirmation Page | 0/TBD | Not started | - |
| 4. Email Admin Page | 0/TBD | Not started | - |
