# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-17)

**Core value:** DRAs can nominate referees and those referees can confirm their own availability — giving the assignor accurate, up-to-date data to make game assignments.
**Current focus:** Phase 1 — Sheet Schema

## Current Position

Phase: 1 of 4 (Sheet Schema)
Plan: 1 of TBD in current phase
Status: Paused at checkpoint (human-verify)
Last activity: 2026-03-18 — Executed 01-01-PLAN.md; paused at Task 2 checkpoint waiting for user to run scripts on test sheet

Progress: [█░░░░░░░░░] ~10%

## Performance Metrics

**Velocity:**
- Total plans completed: 0 (01-01 paused at checkpoint — not yet fully complete)
- Average duration: —
- Total execution time: ~20 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-sheet-schema | 0 complete (1 in progress) | ~20 min | — |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Email sending uses mailto links opening Outlook (NOT MailApp/GmailApp) — assignor is on Microsoft 365
- Sheet columns R-Y must be appended (never inserted) to preserve existing nomination column indices
- Confirmation URL format: confirm.html?token=UUID
- Token pre-generation (column R) deferred to Phase 2 — Phase 1 only adds the header, leaves column R blank
- ConfirmationDeadline named range at Z1; label "Confirmation Deadline:" written to AA1
- Conditional formatting included in setup script (gray/yellow/green/red by status value)

### Column Index Constants (confirmed for Phase 2+)

These are 1-based values for getRange, and 0-based array indices for appendRow/getValues:

| Col | 1-based | 0-based | Header |
|-----|---------|---------|--------|
| R | 18 | 17 | Token |
| S | 19 | 18 | Status |
| T | 20 | 19 | SentAt |
| U | 21 | 20 | ConfirmedAt |
| V | 22 | 21 | RefWeekend1 |
| W | 23 | 22 | RefWeekend2 |
| X | 24 | 23 | RefHotel |
| Y | 25 | 24 | RefNotes |
| Z | 26 | 25 | ConfirmationDeadline (named range) |

### Pending Todos

- User must run setup scripts on test copy of sheet (Task 2 checkpoint)
- After checkpoint approval: run scripts on production sheet
- Enter actual tournament confirmation deadline date in cell Z1

### Blockers/Concerns

- **ACTIVE CHECKPOINT:** 01-01 Task 2 is a human-verify checkpoint — Phase 2 cannot begin until user confirms all verification checks PASS
- Verify tnsoccer.org account type (Google Workspace vs personal Gmail) before Phase 4 — affects MailApp quota if ever switching to server-side send
- Confirm GitHub Pages URL (user vs org account) before Phase 4 — email mailto links embed this URL
- ~~Verify exact column count of current sheet (expected 17, A-Q) during Phase 1~~ — Handled by setup script guard (throws error if not 17 columns)

## Session Continuity

Last session: 2026-03-18
Stopped at: 01-01-PLAN.md Task 2 checkpoint — waiting for user to run scripts on test sheet and approve
Resume file: None
