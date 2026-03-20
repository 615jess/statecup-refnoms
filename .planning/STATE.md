# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** DRAs nominate referees with minimal effort (name + email + max ages + notes), and referees provide their own details directly — giving the assignor accurate, first-hand data to make game assignments.
**Current focus:** v2.0 Phase 3 — Referee Detail Form + Backend (Plans 01-02 complete)

## Current Position

Phase: 3 of 4 (Referee Detail Form + Backend)
Plan: 2 of 3 complete in Phase 3
Status: In progress — Plans 01-02 complete; Plan 03 (admin page) next
Last activity: 2026-03-20 — Completed 03-02-PLAN.md: referee-details.html form with 6 UI states

Progress: [███████░░░] 70%

## Performance Metrics

**Velocity:**
- Total plans completed: 6 (1 from v1.0 Phase 1 + 1 from v2.0 Phase 1 + 2 from v2.0 Phase 2 + 2 from v2.0 Phase 3)
- Average duration: ~22 min (updated with 4-min Plan 03-02)
- Total execution time: ~127 min (+ checkpoint waits)

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

### Pending Todos

- Enter actual tournament deadline date in cell Z1 on production sheet
- Confirm GitHub Pages URL (referee form URL embedded in every admin mailto link)
- Resolve SentAt column T behavior before Phase 4 (server never sends email — auto-write not possible)
- Update DRA dropdown placeholder emails for Don Eubank and Mark Herrington before go-live

### Blockers/Concerns

- Column T (SentAt) writer mechanism still TBD — must resolve before Phase 4 planning

### Phase 3 Plan 02 Artifacts (committed 2026-03-20)

- `referee-details.html` — complete referee detail form: 6 UI states (loading/form/closed/error/success + late-banner), Yes/No toggle buttons, conditional hotel fields, pre-fill support, CORS-safe fetch GET/POST, mobile responsive, SCRIPT_URL = PLACEHOLDER_DEPLOYMENT_URL (update after Plan 03 deployment)

### Phase 3 Plan 01 Artifacts (committed 2026-03-20)

- `scripts/refdetails.gs` — doGet endpoint, _handleGetDetails, _handleSubmitDetails, _getDeadlineState, _findRowByToken helpers, Phase 3 COL_* constants
- `scripts/nominatev2.gs` — submitDetails routing case added to doPost (Phase 3 handler in refdetails.gs)
- Deployment: new deployment required after all Phase 3 plans complete (refdetails.gs must be pasted into Apps Script editor first)

### Phase 2 Artifacts (committed 2026-03-19)

- `scripts/nominatev2.gs` — doPost handler with nominateV2 action, email dedup, UUID token gen, LockService, K-L column writes, setTournamentConstants
- `spring-state-cup-nomination.html` — v2.0 DRA nomination form (6 fields, append-mode upload, nominateV2 payload)
- `.planning/COLUMN-MAP.md` — updated: K-L writer corrected to DRA form
- Deployment URL: `https://script.google.com/macros/s/AKfycbyK7iYFG7dx8eAaiUreQAC5yowwxzW8vg2QrtGc6z3WKO2K3OWQlR_YnwLDiz3eTQs/exec`
- Script Properties set: ASSIGNOR_EMAIL, WEEKEND_1_DATES, WEEKEND_2_DATES, REF_FORM_URL (TBD)

### Phase 1 Artifacts (committed 2026-03-19)

- `scripts/setup-schema-v2.gs` — v2.0 schema setup (setupSchemaV2 entry point)
- `scripts/verify-schema-v2.gs` — v2.0 verification suite (verifySchemaV2 entry point)
- `.planning/COLUMN-MAP.md` — authoritative A-Z column reference for all phases
- v1.0 scripts removed: setup-confirmation-columns.gs, verify-sheet-structure.gs

## Session Continuity

Last session: 2026-03-20T13:09:40Z
Stopped at: Completed 03-02-PLAN.md — referee-details.html done, Plan 03 (admin page) is next
Resume file: None
