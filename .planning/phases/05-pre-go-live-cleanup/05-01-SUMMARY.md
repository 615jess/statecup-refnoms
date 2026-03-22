---
phase: 05-pre-go-live-cleanup
plan: 01
subsystem: infra
tags: [gas, google-apps-script, github-pages, deployment-url, production-config]

# Dependency graph
requires:
  - phase: 02-dra-form-nominatev2
    provides: setTournamentConstants with REF_FORM_URL placeholder
  - phase: 03-referee-detail-form
    provides: GitHub Pages referee-details.html (URL to confirm)
  - phase: 04-email-admin-page
    provides: admin.html with stale deployment URL
provides:
  - All production values applied to source code before go-live
  - Single consolidated GAS deployment URL across all 3 HTML files
  - Real DRA emails in nomination form (no placeholder values)
  - ConfirmationDeadline date confirmed set in Google Sheet Z1
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single deployment URL pattern: all HTML files share one GAS deployment URL"

key-files:
  created: []
  modified:
    - spring-state-cup-nomination.html
    - scripts/nominatev2.gs
    - referee-details.html
    - admin.html

key-decisions:
  - "GAS deployment URL for Phase 5: AKfycbz8bfYLVk3jUl_XaAfNQDu7F2-h8XiJlmoxEfSqWMUsHsnYmdKb6ayt4DTJmuwn9v0l/exec — this is the consolidated production URL for all HTML files"
  - "Don Eubank (SRA) email: sra@tnsoccer.org; Mark Herrington (SYRA) email: syra@tnsoccer.org"
  - "GitHub Pages REF_FORM_URL: https://615jess.github.io/statecup-refnoms/referee-details.html"
  - "Tournament deadline: May 1, 2026 (entered in Google Sheet Z1 named range ConfirmationDeadline)"

patterns-established:
  - "Production config: all environment-specific values must be replaced before deploying to real users"

# Metrics
duration: ~20min
completed: 2026-03-22
---

# Phase 5 Plan 01: Production Values Summary

**Replaced all TODO/TBD placeholder values with real production config: DRA emails, GitHub Pages URL, consolidated GAS deployment URL, and Google Sheet deadline date**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-22
- **Completed:** 2026-03-22T11:25:45-05:00
- **Tasks:** 3 (including 2 checkpoints)
- **Files modified:** 4

## Accomplishments

- Replaced TODO_ DRA email placeholders with real addresses: sra@tnsoccer.org and syra@tnsoccer.org
- Set REF_FORM_URL in nominatev2.gs setTournamentConstants to confirmed GitHub Pages URL
- Consolidated all 3 HTML files to use the single new production GAS deployment URL
- User confirmed tournament deadline date (May 1, 2026) entered in Google Sheet cell Z1

## Task Commits

Each task was committed atomically:

1. **Task 1: Collect production values from user** - checkpoint (no commit — decision collection)
2. **Task 2: Apply all production values to source code** - `495ac0c` (feat)
3. **Task 3: Set tournament deadline date in Google Sheet** - checkpoint (no commit — manual step)

**Plan metadata:** (pending — docs commit)

## Files Created/Modified

- `spring-state-cup-nomination.html` — DRA dropdown emails updated: Don Eubank → sra@tnsoccer.org, Mark Herrington → syra@tnsoccer.org; new GAS deployment URL
- `scripts/nominatev2.gs` — REF_FORM_URL set to https://615jess.github.io/statecup-refnoms/referee-details.html; stale TBD comment removed
- `referee-details.html` — SCRIPT_URL updated to new consolidated deployment URL
- `admin.html` — SCRIPT_URL updated to new consolidated deployment URL

## Decisions Made

- **Consolidated to a single new GAS deployment URL** (AKfycbz8...) rather than reusing any prior phase deployment, because each code change in Apps Script requires a new deployment
- **Used variable names as-is**: SHEET_URL in nomination form, SCRIPT_URL in referee-details and admin — same URL value, different variable names by convention from their respective phases

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. The Google Sheet cell Z1 update was performed by the user as Task 3 (checkpoint:human-action).

## Next Phase Readiness

**Phase 5 is the final phase. The system is production-ready.**

All 4 tech debt items from the v2.0-MILESTONE-AUDIT.md are resolved:
1. DRA placeholder emails — replaced with sra@tnsoccer.org and syra@tnsoccer.org
2. REF_FORM_URL source mismatch — set to confirmed GitHub Pages URL in nominatev2.gs
3. Deployment URL consolidation — all 3 HTML files now share one URL
4. ConfirmationDeadline — user confirmed May 1, 2026 entered in Z1

No blockers. Ready for real DRAs and referees to use the system.

---
*Phase: 05-pre-go-live-cleanup*
*Completed: 2026-03-22*
