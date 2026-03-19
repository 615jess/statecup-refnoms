# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** DRAs nominate referees with minimal effort (name + email + max ages + notes), and referees provide their own details directly — giving the assignor accurate, first-hand data to make game assignments.
**Current focus:** v2.0 Phase 1 — Schema Setup

## Current Position

Phase: 1 of 4 (Schema Setup)
Plan: 1 of TBD in current phase
Status: At checkpoint — awaiting human verification of 01-01 schema scripts
Last activity: 2026-03-19 — Executed 01-01-PLAN.md Tasks 1 and 2; at Task 3 checkpoint

Progress: [█░░░░░░░░░] ~10% (Phase 1 plan 1 tasks complete, awaiting checkpoint approval)

## Performance Metrics

**Velocity:**
- Total plans completed: 1 (from v1.0 Phase 1)
- Average duration: ~20 min
- Total execution time: ~20 min (+ checkpoint wait)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- **v2.0 PIVOT (2026-03-19):** Workflow changed from DRA-provides-all-details to referee-provides-own-details
- Status values locked: Not Sent / Sent / Confirmed (replaces v1.0 Confirmed/Declined)
- Column X repurposed: LateFlag (was RefHotel in v1.0)
- Token generated at nomination time in doPost nominateV2 (not at admin-page-load)
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

### Phase 1 Artifacts (committed 2026-03-19)

- `scripts/setup-schema-v2.gs` — v2.0 schema setup (setupSchemaV2 entry point)
- `scripts/verify-schema-v2.gs` — v2.0 verification suite (verifySchemaV2 entry point)
- `.planning/COLUMN-MAP.md` — authoritative A-Z column reference for all phases
- v1.0 scripts removed: setup-confirmation-columns.gs, verify-sheet-structure.gs

## Session Continuity

Last session: 2026-03-19
Stopped at: 01-01 Task 3 checkpoint — awaiting user verification of schema on Google Sheet
Resume file: None (awaiting "approved" signal to create SUMMARY.md and close plan)
