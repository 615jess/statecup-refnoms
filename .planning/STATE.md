# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** DRAs nominate referees with minimal effort (name + email only), and referees provide their own details directly — giving the assignor accurate, first-hand data to make game assignments.
**Current focus:** Milestone v2.0 — Defining requirements

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements for v2.0 milestone
Last activity: 2026-03-19 — Milestone v2.0 started (pivoted from v1.0 confirmation workflow)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 1 (from v1.0)
- Average duration: ~20 min
- Total execution time: ~20 min (+ checkpoint wait)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- **v2.0 PIVOT (2026-03-19):** Workflow changed from DRA-provides-all-details → referee-provides-own-details
- Email sending uses mailto links opening Outlook (NOT MailApp/GmailApp) — assignor is on Microsoft 365
- Sheet columns R-Y exist from v1.0 Phase 1 — may need rethinking for v2.0 column structure
- Confirmation URL format: confirm.html?token=UUID (still valid)
- ConfirmationDeadline named range at Z1; label "Confirmation Deadline:" written to AA1
- Late submissions allowed with flag; referee sees a notice
- Referee can edit until deadline, then locked (read-only after)
- Reuse existing token for re-nominated referees (same referee = same link)
- doGet response should include context (tournament dates, assignor contact, DRA name) + deadline

### Column Index Constants (from v1.0 Phase 1 — may need revision)

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

### v1.0 Phase 1 Status

Phase 1 (Sheet Schema) was completed in v1.0:
- Columns R-Y appended to sheet with correct headers
- Status column with dropdown validation and conditional formatting
- ConfirmationDeadline named range at Z1
- Setup scripts verified on test copy
- **NOTE:** Production sheet may not have these applied yet

### Pending Todos

- Apply v1.0 setup scripts to the production sheet (user action — if still applicable after v2.0 schema decisions)
- Enter actual tournament confirmation deadline date in cell Z1 on production sheet
- Decide whether v1.0 columns R-Y schema still fits v2.0 workflow or needs changes

### Blockers/Concerns

- Verify tnsoccer.org account type (Google Workspace vs personal Gmail) — affects MailApp quota if ever switching to server-side send
- Confirm GitHub Pages URL (user vs org account) — email mailto links embed this URL
- Existing DRA nomination form (columns A-Q) collects 14 fields per referee; v2.0 simplifies to name + email — need to decide: modify existing form or create new one?

## Session Continuity

Last session: 2026-03-19
Stopped at: Milestone v2.0 started — defining requirements
Resume file: None
