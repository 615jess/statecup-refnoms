# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-17)

**Core value:** DRAs can nominate referees and those referees can confirm their own availability — giving the assignor accurate, up-to-date data to make game assignments.
**Current focus:** Phase 1 — Sheet Schema

## Current Position

Phase: 1 of 4 (Sheet Schema)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-03-18 — Roadmap created, v1.0 phases 1-4 defined

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

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

### Pending Todos

None yet.

### Blockers/Concerns

- Verify tnsoccer.org account type (Google Workspace vs personal Gmail) before Phase 4 — affects MailApp quota if ever switching to server-side send
- Confirm GitHub Pages URL (user vs org account) before Phase 4 — email mailto links embed this URL
- Verify exact column count of current sheet (expected 17, A-Q) during Phase 1 before writing column constants

## Session Continuity

Last session: 2026-03-18
Stopped at: Roadmap created — ready to plan Phase 1
Resume file: None
