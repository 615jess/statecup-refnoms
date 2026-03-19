# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-17)

**Core value:** DRAs can nominate referees and those referees can confirm their own availability — giving the assignor accurate, up-to-date data to make game assignments.
**Current focus:** Phase 2 — Apps Script Backend

## Current Position

Phase: 2 of 4 (Apps Script Backend)
Plan: 0 of 2 in current phase
Status: Phase 1 complete — ready to plan Phase 2
Last activity: 2026-03-18 — Phase 1 verified (6/6 must-haves), SHEET-03/04/05 complete

Progress: [███░░░░░░░] 25%

## Performance Metrics

**Velocity:**
- Total plans completed: 1
- Average duration: ~20 min
- Total execution time: ~20 min (+ checkpoint wait)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-sheet-schema | 1 complete | ~20 min | ~20 min |

**Recent Trend:**
- Last 5 plans: 01-01 (sheet schema setup scripts, 2-task plan with human-verify checkpoint)
- Trend: On track

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
- User verified all checks PASS on test copy — ConfirmationDeadline label in AA1 is acceptable

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

- Apply setup scripts to the production sheet (user action)
- Enter actual tournament confirmation deadline date in cell Z1 on production sheet

### Blockers/Concerns

- Verify tnsoccer.org account type (Google Workspace vs personal Gmail) before Phase 4 — affects MailApp quota if ever switching to server-side send
- Confirm GitHub Pages URL (user vs org account) before Phase 4 — email mailto links embed this URL

## Session Continuity

Last session: 2026-03-18
Stopped at: Phase 1 complete — ready to plan Phase 2
Resume file: None
