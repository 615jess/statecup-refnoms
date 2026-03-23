# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** DRAs nominate referees with minimal effort (name + email + max ages + notes), and referees provide their own details directly — giving the assignor accurate, first-hand data to make game assignments.
**Current focus:** Phase 5.1 — Parent/Guardian Email for Minors (inserted feature)

## Current Position

Phase: 5.1 of 5.1 (Parent/Guardian Email for Minors) — Complete
Plan: 2 of 2 in Phase 5.1 — Plan 05.1-02 complete
Status: All phases complete
Last activity: 2026-03-23 — Completed 05.1-02-PLAN.md (frontend conditional field + admin column)

Progress: [████████████] 12/12 plans complete

## Performance Metrics

**Velocity:**
- Total plans completed: 12 (1 from v1.0 Phase 1 + 1 from v2.0 Phase 1 + 2 from v2.0 Phase 2 + 3 from v2.0 Phase 3 + 2 from v2.0 Phase 4 + 1 from v2.0 Phase 5 + 2 from Phase 5.1)
- Average duration: ~17 min
- Total execution time: ~177 min (+ checkpoint waits)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- **v2.0 PIVOT (2026-03-19):** Workflow changed from DRA-provides-all-details to referee-provides-own-details
- Status values locked: Not Sent / Sent / Confirmed (replaces v1.0 Confirmed/Declined)
- Column X repurposed: LateFlag (was RefHotel in v1.0)
- Token generated at nomination time in doPost nominateV2 (not at admin-page-load)
- Columns K-L (Max Age as AR, Max Age as Ref) are DRA-provided, not referee-provided (corrected from initial column map)
- DRA dropdown: Don Eubank = SRA, Mark Herrington = SYRA, State Cup Assignor (no personal name)
- Apps Script requires new deployment per code change — cannot update existing deployment in-place
- Email via mailto links opening Outlook — NOT MailApp (assignor is on Microsoft 365)
- REF_FORM_URL left as TODO — GitHub Pages URL not yet confirmed; must set before Phase 4 [RESOLVED Phase 5]

### Column Index Constants (v2.0)

| Col | 1-based | 0-based | Header | Writer |
|-----|---------|---------|--------|--------|
| I | 9 | 8 | Phone | Referee form |
| J | 10 | 9 | Age | Referee form |
| K | 11 | 10 | Max Age as AR | DRA form |
| L | 12 | 11 | Max Age as Ref | DRA form |
| M-P | 13-16 | 12-15 | Referee detail fields | Referee form |
| R | 18 | 17 | Token | System (nominateV2) |
| S | 19 | 18 | Status | System |
| T | 20 | 19 | SentAt | TBD (Phase 4 decision) |
| U | 21 | 20 | SubmittedAt | System (submitDetails) |
| V | 22 | 21 | RefWeekend1 | Referee form |
| W | 23 | 22 | RefWeekend2 | Referee form |
| X | 24 | 23 | LateFlag | System (submitDetails) |
| Y | 25 | 24 | RefNotes | Referee form |
| Z | 26 | 25 | ConfirmationDeadline (named range) | Assignor |
| AB | 28 | 27 | Parent/Guardian Email | Referee form (Phase 5.1) |

### Roadmap Evolution

- Phase 5.1 inserted after Phase 5: Parent/Guardian Email for Minors (URGENT) — add conditional parent/guardian email field for referees under 18, new column AB in sheet

### Pending Todos

None.

### Blockers/Concerns

None.

### Phase 5.1 Artifacts (complete — 2026-03-23)

- `scripts/refdetails.gs` — COL_PARENT_EMAIL = 28, _handleGetDetails returns parentEmail from rowData[27], _handleSubmitDetails writes payload.parentEmail to column AB (Step 9), getValues range expanded to 28 cols
- `scripts/adminemail.gs` — _handleGetAllNominees returns age (r[9]) + parentEmail (r[27]) per nominee, getValues range expanded to 28 cols
- `scripts/setup-schema-v2.gs` — COL_PARENT_EMAIL = 28, HEADERS_V2 expanded to 28 entries (AA='' + AB='Parent/Guardian Email'), setValues and clearContent ranges expanded to 28 cols
- `.planning/COLUMN-MAP.md` — AB row added, COL_PARENT_EMAIL in constants, AB in writer summary, Column AB usage note
- `referee-details.html` — conditional `#parent-email-row` div, `updateParentEmailVisibility()`, validation, payload, pre-fill, success summary
- `admin.html` — Parent Email th + td, sort case, filter haystack, colspan=8
- Plan 05.1-01 Commits: `a9c6156` (refdetails.gs), `8081716` (adminemail.gs + setup-schema-v2.gs + COLUMN-MAP.md)
- Plan 05.1-02 Commits: `66e4320` (referee-details.html), `9a28b1c` (admin.html)

### Phase 4 Artifacts (complete — verified 2026-03-21)

- `scripts/adminemail.gs` — `_handleGetAllNominees` (returns all nominees + tournament props), `_handleMarkSent` (LockService, idempotent, writes Status + SentAt), `COL_SENT_AT = 20`
- `scripts/refdetails.gs` (modified) — doGet now routes `action=getAllNominees` before token lookup
- `scripts/nominatev2.gs` (modified) — doPost now routes `action=markSent` alongside nominateV2 and submitDetails
- `admin.html` — complete email admin page (617 lines): sortable/filterable nominee table, mailto links, auto-mark-Sent, summary counts
- Plan 04-01 Commits: `388aab1` (adminemail.gs), `dbf64be` (routing extensions)
- Plan 04-02 Commits: `9853359` (admin.html), `8d5aa71` (checkpoint metadata)
- E2E Verification: User approved 2026-03-21 — all success criteria passed

### Phase 3 Artifacts (committed 2026-03-20)

- `scripts/refdetails.gs` — doGet endpoint, _handleGetDetails, _handleSubmitDetails, _getDeadlineState, _findRowByToken helpers, Phase 3 COL_* constants
- `scripts/nominatev2.gs` — submitDetails routing case added to doPost
- `referee-details.html` — complete referee detail form: 6 UI states, toggle buttons, conditional hotel fields, pre-fill, CORS-safe fetch, mobile responsive
- Phase 3 Deployment URL: `https://script.google.com/macros/s/AKfycby996qdKYYwNJjlJ8WE32Npve7e72Ih546_D8ExItU9OPrC4StbODRoOd4kr1qwB1F6/exec`
- Phase 3 Verification: 6/6 success criteria passed

### Phase 2 Artifacts (committed 2026-03-19)

- `scripts/nominatev2.gs` — doPost handler with nominateV2 action, email dedup, UUID token gen, LockService, K-L column writes, setTournamentConstants
- `spring-state-cup-nomination.html` — v2.0 DRA nomination form (6 fields, append-mode upload, nominateV2 payload)
- `.planning/COLUMN-MAP.md` — updated: K-L writer corrected to DRA form
- Phase 2 Deployment URL: `https://script.google.com/macros/s/AKfycbyK7iYFG7dx8eAaiUreQAC5yowwxzW8vg2QrtGc6z3WKO2K3OWQlR_YnwLDiz3eTQs/exec`
- Script Properties set: ASSIGNOR_EMAIL, WEEKEND_1_DATES, WEEKEND_2_DATES, REF_FORM_URL (TBD)

### Phase 1 Artifacts (committed 2026-03-19)

- `scripts/setup-schema-v2.gs` — v2.0 schema setup (setupSchemaV2 entry point)
- `scripts/verify-schema-v2.gs` — v2.0 verification suite (verifySchemaV2 entry point)
- `.planning/COLUMN-MAP.md` — authoritative A-Z column reference for all phases
- v1.0 scripts removed: setup-confirmation-columns.gs, verify-sheet-structure.gs

## Session Continuity

Last session: 2026-03-23 20:47-20:49 UTC
Stopped at: Completed 05.1-02-PLAN.md — frontend conditional parent email field + admin column
Resume file: None
