# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** DRAs nominate referees with minimal effort (name + email + max ages + notes), and referees provide their own details directly — giving the assignor accurate, first-hand data to make game assignments.
**Current focus:** v2.0 Phase 2 — DRA Form + nominateV2

## Current Position

Phase: 2 of 4 (DRA Form + nominateV2) — In Progress
Plan: 1 of 2 complete in Phase 2 (02-01 nominateV2 handler ✓)
Status: In progress — Plan 02-01 complete, ready for Plan 02-02 (DRA form HTML)
Last activity: 2026-03-19 — Completed 02-01-PLAN.md: nominateV2 handler deployed and verified

Progress: [███░░░░░░░] 33%

## Performance Metrics

**Velocity:**
- Total plans completed: 3 (1 from v1.0 Phase 1 + 1 from v2.0 Phase 1 + 1 from v2.0 Phase 2)
- Average duration: ~35 min
- Total execution time: ~90 min (+ checkpoint waits)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- **v2.0 PIVOT (2026-03-19):** Workflow changed from DRA-provides-all-details to referee-provides-own-details
- Status values locked: Not Sent / Sent / Confirmed (replaces v1.0 Confirmed/Declined)
- Column X repurposed: LateFlag (was RefHotel in v1.0)
- Token generated at nomination time in doPost nominateV2 (not at admin-page-load) — prevents token churn on re-nomination
- Referee writes to columns I-P (same columns DRA used in v1.0 — writer changes, positions stay)
- Email via mailto links opening Outlook — NOT MailApp (assignor is on Microsoft 365)
- Admin page is static HTML on GitHub Pages (not Apps Script menu)

### Column Index Constants (v2.0 — verify in Phase 1)

| Col | 1-based | 0-based | Header | Writer |
|-----|---------|---------|--------|--------|
| I-P | 9-16 | 8-15 | Referee detail fields | Referee form |
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

### Blockers/Concerns

- Spreadsheet upload on simplified DRA form: retain with 4-col template or remove entirely? (resolve at Phase 2 plan time)
- Column T (SentAt) writer mechanism still TBD — must resolve before Phase 4 planning

### Phase 2 Artifacts (committed 2026-03-19)

- `scripts/nominatev2.gs` — doPost handler with nominateV2 action, email dedup, UUID token gen, LockService, setTournamentConstants
- Deployment URL: `https://script.google.com/macros/s/AKfycbxYnpu2W6DpxJFkaU-nRF_DsHPhR9dPoSerN6kD7E89e_qJpKsOwFRb-WsD-4NApos/exec`
- Script Properties set: ASSIGNOR_EMAIL, WEEKEND_1_DATES, WEEKEND_2_DATES, REF_FORM_URL (TBD)

### Phase 1 Artifacts (committed 2026-03-19)

- `scripts/setup-schema-v2.gs` — v2.0 schema setup (setupSchemaV2 entry point)
- `scripts/verify-schema-v2.gs` — v2.0 verification suite (verifySchemaV2 entry point)
- `.planning/COLUMN-MAP.md` — authoritative A-Z column reference for all phases
- v1.0 scripts removed: setup-confirmation-columns.gs, verify-sheet-structure.gs

## Session Continuity

Last session: 2026-03-19
Stopped at: Completed 02-01-PLAN.md — nominateV2 handler deployed and verified, ready for Plan 02-02 (DRA form HTML)
Resume file: None
