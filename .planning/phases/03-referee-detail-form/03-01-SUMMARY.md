---
phase: 03-referee-detail-form
plan: 01
subsystem: api
tags: [google-apps-script, doGet, doPost, token-auth, spreadsheet, deadline-enforcement]

# Dependency graph
requires:
  - phase: 02-dra-form-nominatev2
    provides: "nominatev2.gs with doPost, _jsonResponse helper, LockService pattern, PropertiesService constants (ASSIGNOR_EMAIL, WEEKEND_1_DATES, WEEKEND_2_DATES), token in column R"
  - phase: 01-schema-setup
    provides: "Google Sheet schema with A-Z columns, ConfirmationDeadline named range at Z1, COL_* constants in COLUMN-MAP.md"
provides:
  - "doGet endpoint that returns referee row data by token — populates referee-details.html on page load"
  - "doPost submitDetails action — writes referee-provided fields to sheet row, enforces deadline, handles LateFlag"
  - "_getDeadlineState(ss) shared helper — open/late/hard_closed state with end-of-day comparison and 3-day grace period"
  - "_findRowByToken(sheet, token) shared helper — batch column R scan, no getValue() in loop"
  - "scripts/refdetails.gs — new file containing all Phase 3 backend logic"
affects:
  - "03-02-PLAN.md: referee-details.html needs SCRIPT_URL pointing to new deployment that includes doGet"
  - "03-03-PLAN.md: admin page backend may reuse _getDeadlineState or deadline display patterns"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared GAS helper functions across .gs files via compiled project scope"
    - "Batch token scan: single getRange() call on column R, iterate array (never getValue() in loop)"
    - "end-of-day deadline comparison: setHours(23,59,59,999) before date arithmetic"
    - "LateFlag guard: read COL_SUBMITTED_AT before writing to distinguish first-submission vs. edit"
    - "doPost action routing via sequential if-checks in nominatev2.gs, handlers in separate files"

key-files:
  created:
    - scripts/refdetails.gs
  modified:
    - scripts/nominatev2.gs

key-decisions:
  - "All five Phase 3 functions written in one pass: helpers (_getDeadlineState, _findRowByToken) placed at top of file so both doGet handler and submitDetails handler share them without duplication"
  - "doGet error suppresses raw err.message to client — logs via Logger.log, returns generic server_error"
  - "_handleSubmitDetails included in same file as doGet (refdetails.gs) per task plan; routing case added to nominatev2.gs doPost"

patterns-established:
  - "Phase 3 column constants (COL_PHONE=9 through COL_REF_NOTES=25) declared in refdetails.gs, not redeclared in nominatev2.gs"
  - "Token lookup always via _findRowByToken helper — single API call pattern enforced"
  - "Deadline logic always via _getDeadlineState helper — no inline deadline code in handlers"

# Metrics
duration: 3min
completed: 2026-03-20
---

# Phase 3 Plan 01: Referee Detail Form Backend Summary

**doGet + doPost submitDetails endpoints in refdetails.gs, with token-batch-scan, end-of-day deadline state, and LateFlag-preserving edit guard**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T12:58:34Z
- **Completed:** 2026-03-20T13:01:49Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `scripts/refdetails.gs` with doGet, _handleGetDetails, _handleSubmitDetails, _getDeadlineState, _findRowByToken, and all Phase 3 column constants
- doGet handles missing token (missing_token error), invalid token (invalid_token error), and server errors (server_error — raw message suppressed from client)
- _handleSubmitDetails: LockService serialization, hard_closed deadline rejection, first-submission vs. edit detection, LateFlag preservation on edits
- Added submitDetails routing case to nominatev2.gs doPost between nominateV2 case and Unknown action fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Create refdetails.gs with doGet and _handleGetDetails** - `d41dfae` (feat)
2. **Task 2: Add submitDetails routing to nominatev2.gs** - `680bd8c` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `scripts/refdetails.gs` — doGet endpoint, _handleGetDetails, _handleSubmitDetails, _getDeadlineState, _findRowByToken, Phase 3 COL_* constants
- `scripts/nominatev2.gs` — submitDetails routing case added to doPost (5 lines added)

## Decisions Made

- Wrote all five functions in a single pass (Task 1 + Task 2 together in refdetails.gs) since the helpers are shared across both handlers; the task split was conceptual but the code is cleaner as one file.
- Suppressed raw error message from doGet catch block — logs via Logger.log, returns generic "An internal error occurred." to client. Avoids leaking row numbers or internal state to the browser.
- Used `_getDeadlineState(ss)` and `_findRowByToken(sheet, token)` helper functions to eliminate code duplication between _handleGetDetails and _handleSubmitDetails (both need deadline state and token scan).

## Deviations from Plan

None — plan executed exactly as written. Both tasks completed in sequence. All five functions (_getDeadlineState, _findRowByToken, doGet, _handleGetDetails, _handleSubmitDetails) written in the first task pass since the helpers are prerequisites for both handler functions.

## Issues Encountered

None.

## User Setup Required

None for this plan — no external services. After Phase 3 is fully deployed (all plans complete), the assignor must:
- Create a new Apps Script deployment including refdetails.gs
- Update `SCRIPT_URL` in referee-details.html with the new /exec URL
- Run `setTournamentConstants()` again to update `REF_FORM_URL` property

## Next Phase Readiness

- Backend endpoints fully implemented and ready for referee-details.html (Plan 02) to call
- doGet returns all fields needed to populate the form on page load
- doPost submitDetails writes all referee columns (I, J, M-P, V-Y) and system columns (S, U)
- No blockers for Plan 02 (referee form HTML/JS)
- Deployment must happen after Plan 02 is complete (new deployment includes both files)

---
*Phase: 03-referee-detail-form*
*Completed: 2026-03-20*
