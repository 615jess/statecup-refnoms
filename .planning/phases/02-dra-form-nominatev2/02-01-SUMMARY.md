---
phase: 02-dra-form-nominatev2
plan: 01
subsystem: api
tags: [google-apps-script, dopost, lockservice, propertiesservice, uuid, deduplication, spreadsheet]

# Dependency graph
requires:
  - phase: 01-schema-setup
    provides: Google Sheet with columns A-S schema and column index constants (COLUMN-MAP.md)
provides:
  - doPost handler (nominateV2 action) that writes columns A-H, Q, R, S to the Google Sheet
  - Email deduplication: within-batch (last-wins) and cross-DRA (existing sheet data)
  - UUID token generation at nomination time via Utilities.getUuid()
  - LockService serialization of concurrent writes
  - setTournamentConstants() storing 4 Script Properties (ASSIGNOR_EMAIL, WEEKEND_1_DATES, WEEKEND_2_DATES, REF_FORM_URL)
  - Deployed web app /exec URL ready for DRA form (Plan 02-02)
affects:
  - 02-02-dra-form (needs the /exec URL as the form POST target)
  - 03-referee-form (reads Token from column R to authenticate referee submissions)
  - 04-admin-page (reads Status from column S, reads Script Properties)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ES5-only Apps Script (var, no const/let, no arrow functions, no template literals) — matches Phase 1 pattern"
    - "LockService try/finally pattern for all sheet writes"
    - "Email normalization: .trim().toLowerCase() at both write-time and index-build-time"
    - "Honeypot: check payload.website before processing — silently return ok:true with empty results"
    - "_jsonResponse helper wraps all doPost returns with correct MIME type"

key-files:
  created:
    - scripts/nominatev2.gs
  modified: []

key-decisions:
  - "Token generated at nomination time in doPost, not at admin-page-load (prevents token churn on re-nomination)"
  - "_updateDraColumns writes only columns A-H and Q — never touches I-P, R, or S"
  - "Within-batch dedup uses last-wins strategy (most recent DRA entry takes effect)"
  - "Deployment: Execute as Me, Who has access: Anyone — required for unauthenticated DRA form POST"
  - "REF_FORM_URL stored as 'TBD' in Script Properties — updated after Phase 3 deployment"

patterns-established:
  - "doPost routes on payload.action string — extensible for future actions (e.g., submitDetails in Phase 3)"
  - "_loadEmailIndex reads column H into memory once per request — avoids repeated getRange calls in loop"
  - "appendRow() inside LockService is safe for concurrent submissions"

# Metrics
duration: ~45min (including checkpoint wait for user deployment)
completed: 2026-03-19
---

# Phase 02 Plan 01: nominateV2 Handler Summary

**Apps Script doPost handler (nominateV2) with email dedup, UUID token generation, LockService, and PropertiesService tournament constants — deployed as web app**

## Performance

- **Duration:** ~45 min (including checkpoint pause for user deployment and verification)
- **Started:** 2026-03-19
- **Completed:** 2026-03-19
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 1

## Accomplishments

- nominatev2.gs written (417 lines, ES5) with full doPost handler routing nominateV2 action
- Email deduplication works at two levels: within-batch (last-wins) and cross-DRA (existing sheet rows via column H index)
- UUID token generated at nomination time via Utilities.getUuid() and written to column R on new rows only — never overwritten on update
- LockService.getScriptLock() with 15-second waitLock and try/finally release pattern prevents concurrent write corruption
- setTournamentConstants() stores 4 Script Properties and verified in Project Settings
- Deployed as web app and verified: new row creates with A-H + Q filled, I-P blank, R = UUID, S = "Not Sent"; re-nomination updates A-H + Q only (no duplicate, I-P/R/S preserved)

## Task Commits

Each task was committed atomically:

1. **Task 1: Write nominatev2.gs — doPost handler with email dedup, token gen, LockService** - `48bc21f` (feat)
2. **Task 2: Deploy nominatev2.gs to Apps Script and verify** - checkpoint:human-verify (no code commit — deployment is out-of-repo)

**Plan metadata:** _(this commit)_ (docs: complete nominateV2 handler plan)

## Files Created/Modified

- `scripts/nominatev2.gs` — doPost handler with nominateV2 action, _handleNominateV2, _deduplicateBatch, _loadEmailIndex, _updateDraColumns, _appendNewRow, _jsonResponse, setTournamentConstants (417 lines, ES5)

## Decisions Made

- **Token at nomination time, not admin-page-load:** Prevents token churn — if a DRA re-nominates the same referee, the existing token in column R is preserved (update path skips R entirely)
- **_updateDraColumns writes A-H and Q only:** Explicit non-touch of I-P, R, S. Two separate getRange calls (one 8-column range for A-H, one setValue for Q column 17) rather than a single range that would span the gap
- **Last-wins within-batch dedup:** If a DRA accidentally submits the same referee twice in one form, the last entry is kept. This matches user expectation ("my latest input wins")
- **Deployment settings:** Execute as Me / Who has access: Anyone — required so the DRA form (a plain HTML page) can POST without Google auth

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**Script Properties populated by setTournamentConstants (run once from Apps Script editor):**
- ASSIGNOR_EMAIL: jerickson@tnsoccer.org
- WEEKEND_1_DATES: May 16 & 17, 2026
- WEEKEND_2_DATES: May 23 & 24, 2026
- REF_FORM_URL: TBD (update after Phase 3 deployment)

**Deployment URL (needed by Plan 02-02):**
`https://script.google.com/macros/s/AKfycbxYnpu2W6DpxJFkaU-nRF_DsHPhR9dPoSerN6kD7E89e_qJpKsOwFRb-WsD-4NApos/exec`

## Next Phase Readiness

- Plan 02-02 (DRA form HTML) can begin immediately — the /exec URL is known
- REF_FORM_URL Script Property is placeholder "TBD" — must be updated after Phase 3 deployment before admin page emails go out
- Column T (SentAt) writer mechanism still TBD — must resolve before Phase 4 planning (tracked in STATE.md)

---
*Phase: 02-dra-form-nominatev2*
*Completed: 2026-03-19*
