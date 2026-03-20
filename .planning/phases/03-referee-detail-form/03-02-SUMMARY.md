---
phase: 03-referee-detail-form
plan: 02
subsystem: ui
tags: [html, css, javascript, google-apps-script, fetch-api, mobile-responsive, state-machine]

# Dependency graph
requires:
  - phase: 03-referee-detail-form/03-01
    provides: "doGet endpoint returning referee row data by token; doPost submitDetails writing referee fields; _getDeadlineState returning open/late/hard_closed; response shape with all fields for form population"
  - phase: 02-dra-form-nominatev2
    provides: "CSS variables, visual style, fetch POST CORS-safe pattern, esc() function, sub-btn class, spin class — all copied verbatim from spring-state-cup-nomination.html"
provides:
  - "referee-details.html — complete single-file static HTML form hosted on GitHub Pages"
  - "Six UI state panels: loading, form (with late-banner), closed, error, success"
  - "Yes/No toggle buttons per weekend (44px touch targets, 16px font) with conditional hotel fields"
  - "Pre-fill support for return visits: correct order (toggles -> visibility -> hotel values)"
  - "CORS-safe fetch GET and POST (no mode:no-cors, no Content-Type header)"
  - "availability payload = 'Yes / No' summary string for column M"
  - "Both-weekends-no confirmation dialog"
  - "Mobile-responsive single-column layout under 560px"
affects:
  - "03-03-PLAN.md: SCRIPT_URL in referee-details.html needs updating after new deployment"
  - "Phase 4 (email): REF_FORM_URL in PropertiesService must match GitHub Pages URL for referee-details.html"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Six-state UI machine driven by doGet response: loading->form/closed/error, POST->success"
    - "Toggle button pair (active-yes/active-no CSS classes) with hidden input for value"
    - "Hotel conditional visibility: updateHotelVisibility() clears value on hide (Pitfall 5)"
    - "Pre-fill sequence: activateWeekendToggle -> updateHotelVisibility -> activateHotelToggle (Pitfall 7)"
    - "CORS-safe GAS POST: raw JSON body, no Content-Type header"
    - "CORS-safe GAS GET: simple fetch(url) with no options"

key-files:
  created:
    - referee-details.html
  modified: []

key-decisions:
  - "Combined Task 1 (structure) and Task 2 (JS) into a single file written in one pass — cleaner than separate HTML/JS authoring passes on same file"
  - "Toggle buttons use hidden <input type='hidden'> to hold selected value rather than data attributes — simpler value reads in submit handler"
  - "Success state: inline summary card (same card pattern as DRA form) rather than toast — mobile users can screenshot"
  - "sub-btn also has min-height: 54px for touch target (exceeds 44px requirement)"

patterns-established:
  - "Header dates dynamically updated from doGet response (hdr-wkd1-dates, hdr-wkd2-dates) after page load"
  - "Assignor contact link populated from data.assignorEmail in all states that need it (form greeting, closed, error)"
  - "Inline error div below submit button — shown on POST failure, hidden on next attempt"

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 3 Plan 02: Referee Detail Form HTML Summary

**Single-file referee-details.html with six UI states, DRA-form-matching visual style, conditional hotel fields, pre-fill support, CORS-safe fetch patterns, and full mobile responsiveness (44px touch targets, 16px fonts, 560px single-column breakpoint)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T13:05:41Z
- **Completed:** 2026-03-20T13:09:40Z
- **Tasks:** 2 (built in one pass)
- **Files modified:** 1

## Accomplishments

- Created `referee-details.html` (812 lines) with all six UI state panels, conditional hotel sections, personalized greeting card, and late deadline banner
- Wired complete JavaScript: URL token parsing, loadRefereeData (doGet fetch), populateForm with correct pre-fill order (Pitfall 7), updateHotelVisibility (clears hotel value on hide per Pitfall 5), submit handler (doPost submitDetails)
- Visual style exactly matches DRA form: identical CSS variables, topbar gradient, hero/dates-row/footer patterns, Open Sans font, same component classes

## Task Commits

Each task was committed atomically:

1. **Task 1 + Task 2: Build referee-details.html structure, styles, states, and JS** - `952754b` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `referee-details.html` — complete referee detail form: 6 UI states, toggle buttons, conditional hotel fields, pre-fill, CORS-safe fetch GET/POST, mobile responsive

## Decisions Made

- Combined both tasks into a single commit because structure and JS are one self-contained file — splitting would require reading/editing the same file twice.
- Used `<input type="hidden">` to hold toggle values rather than reading CSS class state in the submit handler — cleaner read pattern.
- Success state built as inline summary card (not toast) so mobile users can screenshot their submission.
- Inline error for POST failures rendered below the submit button, not replacing the form — preserves user data if they need to retry.
- `showSuccessState` takes the payload directly so it can render submitted data without a round-trip to the server.
- sub-btn min-height set to 54px (exceeds 44px touch target requirement).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None for this plan. After all Phase 3 plans are complete:

- Paste `scripts/refdetails.gs` into the Apps Script editor
- Create a new deployment (Deploy > New deployment > Web app)
- Update `SCRIPT_URL = 'PLACEHOLDER_DEPLOYMENT_URL'` in `referee-details.html` with the new /exec URL
- Run `setTournamentConstants()` to update `REF_FORM_URL` property
- Host `referee-details.html` on GitHub Pages alongside the DRA form

## Next Phase Readiness

- `referee-details.html` is complete and matches all plan requirements
- Plan 03 (admin page) can proceed — it does not depend on referee-details.html
- Deployment step (updating SCRIPT_URL) is the only remaining item before the referee form is live
- No blockers for Plan 03

---
*Phase: 03-referee-detail-form*
*Completed: 2026-03-20*
