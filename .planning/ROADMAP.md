# Roadmap: State Cup Referee Nominations — v2.0

## Overview

v2.0 pivots from a DRA-provides-all workflow to a referee-provides-own-details workflow. The sheet schema is stabilized first so no subsequent phase writes to undefined or mis-validated columns. The DRA nomination form and its backend are simplified and verified with live sheet rows. The referee detail form and its full doGet/doPost backend — the core of v2.0 — are built against those verified rows. The assignor email admin page ships last because it embeds the finalized referee form URL into every mailto link.

## Milestones

- (archived) **v1.0 Sheet Schema Bootstrap** — Phase 1 complete (superseded by v2.0)
- **v2.0 Referee Nomination & Detail Collection** — Phases 1-4 (complete)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Schema Setup** — Rework column structure for v2.0 status values, late flag, and referee-provided fields
- [x] **Phase 2: DRA Form + nominateV2** — Simplified nomination form with token generation and email deduplication
- [x] **Phase 3: Referee Detail Form + Backend** — Token-secured detail form with all doGet/doPost endpoint logic
- [x] **Phase 4: Email Admin Page + getAllNominees** — Assignor-facing nominee table with pre-composed mailto links

## Phase Details

### Phase 1: Schema Setup
**Goal**: The Google Sheet has the correct v2.0 column structure with valid status values, a late-flag column, and a confirmed column mapping document — so every phase that follows writes to defined columns with accepted values
**Depends on**: Nothing (first phase)
**Requirements**: SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04, SCHEMA-05
**Success Criteria** (what must be TRUE):
  1. Column S data validation accepts exactly: Not Sent / Sent / Confirmed (v2.0 vocabulary) and rejects any other value without silent orange-triangle warnings
  2. Column X header reads "LateFlag" and is documented in the column map (repurposed from v1.0 RefHotel)
  3. A named range "ConfirmationDeadline" at Z1 exists and a date can be entered and read back via Apps Script
  4. Existing v1.0 nomination form (if used) still writes correctly to its expected columns without error
  5. A verified column map document lists every column A-Z with header, writer (DRA form / referee form / system), and 1-based index for use in all subsequent phases
**Plans**: 1 plan

Plans:
- [x] 01-01-PLAN.md — Write v2.0 setup/verify scripts and column map, remove v1.0 scripts

### Phase 2: DRA Form + nominateV2
**Goal**: A DRA can submit referee nominations (individually or via spreadsheet upload) and each nomination creates exactly one sheet row with a token, leaving referee-detail columns blank — ready for the referee to fill
**Depends on**: Phase 1
**Requirements**: NOM-01, NOM-02, NOM-03, NOM-04, NOM-05, API-03, API-05, API-08, UX-02
**Success Criteria** (what must be TRUE):
  1. DRA submits a nomination with first name, last name, email, max age as AR, max age as referee, and DRA notes — a single row appears in the sheet with columns A-H and Q filled and columns I-P blank
  2. Token (UUID) is present in column R of the new row immediately after nomination; detail-columns I-P are blank
  3. Nominating the same referee email a second time updates the existing row's DRA fields without creating a duplicate row and without overwriting columns I-P
  4. Submitting a spreadsheet with multiple referees creates one row per referee with no duplicates, even if the same email appears twice in the upload
  5. Tournament constants (assignor email, weekend dates, form URL) are stored in PropertiesService and readable by the backend
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Write nominateV2 Apps Script handler (doPost, email dedup, token gen, LockService, PropertiesService)
- [x] 02-02-PLAN.md — Rewrite DRA nomination form for v2.0 (6-field cards, append-mode upload, nominateV2 payload, new/updated summary)

### Phase 3: Referee Detail Form + Backend
**Goal**: A referee who opens their token link can view tournament context, fill out their availability and contact details, submit, and return to edit until the deadline — and the assignor sees the submitted data in the sheet
**Depends on**: Phase 2
**Requirements**: DETAIL-01, DETAIL-02, DETAIL-03, DETAIL-04, DETAIL-05, DETAIL-06, DETAIL-07, DETAIL-08, DETAIL-09, DETAIL-10, DETAIL-11, API-01, API-02, API-04, API-06, UX-01
**Success Criteria** (what must be TRUE):
  1. Opening referee-details.html?token=VALID_TOKEN returns the referee's name, DRA name, tournament dates, assignor contact, and any previously submitted data — all displayed before the referee types anything
  2. A referee submits availability for both weekends, hotel preference per confirmed weekend, age, gender, phone, day-specific limitations, and notes — the corresponding sheet columns are updated (not appended) and status transitions to Confirmed
  3. Re-opening the same token link before the deadline shows the previously submitted values pre-filled and allows editing; re-submission overwrites the prior entry without creating a new row
  4. After the deadline (but before hard close), the form accepts submission and sets LateFlag = Y in the sheet; referee sees an inline late-submission notice
  5. After hard close, the form displays a friendly "responses are closed" message with assignor contact — no submission is possible
  6. Opening the form with an invalid or missing token shows an error state with the assignor contact email and a retry prompt; no 500 or HTML error page is returned
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — Build doGet getDetails and doPost submitDetails backend endpoints (refdetails.gs + nominatev2.gs routing)
- [x] 03-02-PLAN.md — Build referee-details.html with all six UI states, conditional hotel fields, pre-fill support, and mobile-responsive layout
- [x] 03-03-PLAN.md — Deploy updated Apps Script, wire deployment URL, and verify end-to-end flow

### Phase 4: Email Admin Page + getAllNominees
**Goal**: The assignor can open the admin page, see every nominee's name, email, DRA, and status at a glance, click a mailto link to open Outlook with a pre-written personalized email, and have the referee's status auto-updated to Sent after clicking
**Depends on**: Phase 3
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, API-07, UX-03
**Success Criteria** (what must be TRUE):
  1. Admin page loads all nominees from the sheet and displays name, email, DRA name, and current status (Not Sent / Sent / Confirmed) in a sortable, filterable table
  2. Clicking a referee's mailto link opens Outlook with To, Subject, and Body pre-filled — body includes referee name, tournament details, the token-secured form link, and assignor contact; body stays under 1800 characters
  3. After clicking a mailto link, the referee's sheet status updates to Sent without requiring the assignor to take any additional action
  4. The assignor can filter or sort the table by status to identify Not Sent referees at a glance
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md — Build adminemail.gs backend (getAllNominees + markSent) and wire doGet/doPost routing
- [x] 04-02-PLAN.md — Build admin.html page (nominee table, mailto links, sort/filter, markSent auto-update)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Schema Setup | v2.0 | 1/1 | Complete | 2026-03-19 |
| 2. DRA Form + nominateV2 | v2.0 | 2/2 | Complete | 2026-03-19 |
| 3. Referee Detail Form + Backend | v2.0 | 3/3 | Complete | 2026-03-20 |
| 4. Email Admin Page + getAllNominees | v2.0 | 2/2 | Complete | 2026-03-21 |
