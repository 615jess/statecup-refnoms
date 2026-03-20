---
phase: 04-email-admin-page
plan: 02
subsystem: ui
tags: [html, css, javascript, mailto, google-apps-script, github-pages, fetch-api]

# Dependency graph
requires:
  - phase: 04-01
    provides: "getAllNominees + markSent backend endpoints in adminemail.gs"
  - phase: 03-referee-detail-form
    provides: "referee-details.html and form URL pattern the admin email links point to"
provides:
  - "admin.html — complete assignor email management page for GitHub Pages"
  - "Sortable/filterable nominee table with mailto links and auto-mark-Sent"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Same CORS-safe fetch pattern (no Content-Type header on POST) as Phase 2/3"
    - "buildMailtoHref constructs full mailto: URL with encodeURIComponent on subject+body"
    - "handleEmailClick awaits markSent before window.location.href = mailto — sheet updated before Outlook opens"
    - "in-place DOM updateRowStatus avoids full table re-render on single status change"

key-files:
  created:
    - "admin.html"
  modified: []

key-decisions:
  - "SCRIPT_URL left as PASTE_NEW_DEPLOYMENT_URL_HERE placeholder — user must update after creating new Apps Script deployment"
  - "handleEmailClick uses optimistic UI update on markSent network error — Outlook still opens, status shows Sent in UI"
  - "max-width: 1100px for admin page (vs 860px for other pages) — table needs more horizontal room"
  - "Default sort: Not Sent first (custom status order: Not Sent=0, Sent=1, Confirmed=2)"
  - "CSS.escape(token) used in querySelector to safely handle token strings as attribute selectors"

patterns-established:
  - "mailto body ~500 chars — well under 1600 char limit, leaves room for longer tournament details"
  - "Badge colors: Not Sent=#e8eaed/#3c4043, Sent=#fef9c3/#854d0e, Confirmed=#dcfce7/#166534"

# Metrics
duration: 12min
completed: 2026-03-20
---

# Phase 4 Plan 02: Email Admin Page Summary

**Single-file admin.html with sortable/filterable nominee table, mailto links that auto-mark-Sent via Apps Script before opening Outlook**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-20T19:40:58Z
- **Completed:** 2026-03-20T19:52:00Z
- **Tasks:** 1 of 2 (Task 2 is checkpoint — awaiting human verification)
- **Files modified:** 1

## Accomplishments
- Self-contained admin.html (617 lines) with no external JS library dependencies
- Sortable table (7 columns) with default Not Sent sort, custom status order
- Real-time search filter by name or email
- mailto links with pre-filled subject and body built from tournament props returned by API
- handleEmailClick awaits markSent POST before opening Outlook — ensures sheet is updated first
- In-place DOM update after markSent — badge and button update without full table re-render
- Summary counts bar (Total, Not Sent, Sent, Confirmed) re-renders after each status change
- Loading/error states with retry button matching project design system
- Matches visual design of referee-details.html exactly (same CSS vars, topbar, hero, dates row)

## Task Commits

Each task was committed atomically:

1. **Task 1: Build admin.html** - `9853359` (feat)

## Files Created/Modified
- `admin.html` — Complete email admin page with all functionality inline

## Decisions Made
- SCRIPT_URL placeholder used — user must paste new deployment URL after creating new Apps Script deployment (per existing pattern from Phases 2-3)
- Optimistic UI update on markSent error — network error is non-blocking; Outlook opens anyway and the UI reflects Sent intent. The admin can refresh to see the true sheet state if needed.
- max-width bumped to 1100px from 860px for admin content area — the 7-column table needs more horizontal room
- CSS.escape(token) used in querySelector — UUID tokens are safe but defensive practice

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**External services require manual configuration before the admin page works:**

1. **Update REF_FORM_URL** — In Apps Script editor, update `setTournamentConstants()` with the actual GitHub Pages URL for referee-details.html. Run the function.

2. **Paste updated scripts** — In Apps Script editor:
   - Replace `refdetails.gs` with the updated version (routes getAllNominees)
   - Replace `nominatev2.gs` with the updated version (routes markSent)
   - Create new script file `adminemail` and paste `scripts/adminemail.gs`

3. **Create new deployment** — Deploy > New deployment > Web app > Execute as Me > Anyone. Copy the new /exec URL.

4. **Update admin.html** — Replace `PASTE_NEW_DEPLOYMENT_URL_HERE` with the new deployment URL, then push to GitHub Pages.

## Next Phase Readiness

- Phase 4 Plan 02 is awaiting human verification (checkpoint) after deployment
- Upon "approved" from the assignor: Phase 4 is complete, v2.0 system is fully deployed
- Backward compatibility testing (DRA form + referee detail form) required at checkpoint

---
*Phase: 04-email-admin-page*
*Completed: 2026-03-20*
