---
phase: 04-email-admin-page
plan: 01
subsystem: api
tags: [google-apps-script, spreadsheet, json-api, lock-service, properties-service]

# Dependency graph
requires:
  - phase: 03-referee-detail-form
    provides: "_findRowByToken, _jsonResponse, _getDeadlineState helpers; COL_TOKEN, COL_STATUS constants; doGet and doPost entry points"
  - phase: 02-dra-form-nominatev2
    provides: "COL_FIRST_NAME, COL_LAST_NAME, COL_REF_EMAIL, COL_DRA_NAME, COL_STATUS, COL_TOKEN constants; LockService pattern; _appendNewRow / _updateDraColumns patterns"
provides:
  - "_handleGetAllNominees: GET ?action=getAllNominees returns all nominee rows as JSON array with tournament props"
  - "_handleMarkSent: POST action=markSent idempotently sets Status=Sent and writes SentAt timestamp"
  - "COL_SENT_AT = 20 constant for column T"
  - "doGet extended: routes getAllNominees before token-based Phase 3 path"
  - "doPost extended: routes markSent alongside nominateV2 and submitDetails"
affects:
  - 04-email-admin-page plan 02 (admin HTML page)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Multi-file GAS shared scope: functions in adminemail.gs callable from refdetails.gs and nominatev2.gs without import"
    - "Action-parameter routing: doGet checks e.parameter.action before falling through to legacy token path"
    - "Idempotent write guard: read current status before writing — skip if not 'Not Sent'"
    - "LockService + try/finally: same pattern as Phase 3 _handleSubmitDetails"

key-files:
  created:
    - scripts/adminemail.gs
  modified:
    - scripts/refdetails.gs
    - scripts/nominatev2.gs

key-decisions:
  - "SentAt (col T) written server-side via markSent action — not client-side timestamp; admin page POSTs markSent after generating mailto"
  - "getAllNominees includes tournament props in response so admin page builds mailto bodies without hardcoding"
  - "Idempotency boundary: 'Not Sent' only — Sent and Confirmed both block overwrite"

patterns-established:
  - "COL_SENT_AT = 20 (column T) declared only in adminemail.gs; all other constants inherited from Phase 2/3 files"
  - "Phase-N routing added to doGet/doPost without touching any existing branch"

# Metrics
duration: 3min
completed: 2026-03-20
---

# Phase 4 Plan 01: Backend — getAllNominees + markSent Apps Script Endpoints Summary

**Two GAS backend functions wired into existing doGet/doPost: getAllNominees returns all nominee rows + tournament props as JSON; markSent idempotently sets Status=Sent and writes SentAt timestamp using LockService**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-20T19:34:29Z
- **Completed:** 2026-03-20T19:37:12Z
- **Tasks:** 2/2
- **Files modified:** 3

## Accomplishments

- Created `scripts/adminemail.gs` with `_handleGetAllNominees` and `_handleMarkSent` — no doGet/doPost declarations, operates entirely via GAS shared scope
- Extended `refdetails.gs` doGet to check `e.parameter.action` first; `getAllNominees` routes to adminemail.gs, token-based path (Phase 3) unchanged
- Extended `nominatev2.gs` doPost with `markSent` branch after `submitDetails` and before the unknown-action fallback; all Phase 2/3 routes untouched

## Task Commits

Each task was committed atomically:

1. **Task 1: Create adminemail.gs with _handleGetAllNominees and _handleMarkSent** - `388aab1` (feat)
2. **Task 2: Extend doGet and doPost routing for Phase 4 actions** - `dbf64be` (feat)

## Files Created/Modified

- `scripts/adminemail.gs` - New Phase 4 file: `_handleGetAllNominees` (reads all rows A-Y, returns nominees + tournament props) and `_handleMarkSent` (LockService, idempotency check, writes Status + SentAt)
- `scripts/refdetails.gs` - doGet updated: action routing before token lookup; header comment updated to reflect Phase 4
- `scripts/nominatev2.gs` - doPost updated: markSent branch added; header comment updated to reflect Phase 4

## Decisions Made

- **getAllNominees includes tournament props in response:** Admin page needs assignorEmail, weekend1Dates, weekend2Dates, refFormUrl, and deadlineDisplay to build mailto bodies — avoids hardcoding in frontend
- **Idempotency boundary is 'Not Sent' only:** Any status other than 'Not Sent' (i.e., Sent or Confirmed) blocks the write — preserves Confirmed status if assignor double-clicks
- **SentAt written server-side:** markSent action writes `new Date()` in the GAS handler — consistent with SubmittedAt pattern from Phase 3

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Existing Apps Script project and deployment will need a new deployment (as noted in accumulated context) before Phase 4 testing.

## Next Phase Readiness

- Backend endpoints complete and committed — ready for Plan 02 (admin HTML page)
- `_handleGetAllNominees` returns the exact shape Plan 02 needs: `{ ok, nominees[], props{} }`
- `_handleMarkSent` returns `{ ok, alreadyMarked }` which Plan 02 uses to update UI state
- Reminder: new Apps Script deployment required before testing (apps script requires new deployment per code change)
- Reminder: set REF_FORM_URL in setTournamentConstants before testing admin page (still TODO per STATE.md)

---
*Phase: 04-email-admin-page*
*Completed: 2026-03-20*
