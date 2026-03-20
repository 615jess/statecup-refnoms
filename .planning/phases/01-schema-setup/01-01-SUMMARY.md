---
phase: 01-schema-setup
plan: 01
subsystem: database
tags: [google-apps-script, google-sheets, schema, validation, named-range, conditional-formatting, ES5]

# Dependency graph
requires: []
provides:
  - scripts/setup-schema-v2.gs — full v2.0 schema setup (header rebuild A-Z, 3-value status validation, ConfirmationDeadline named range, conditional formatting)
  - scripts/verify-schema-v2.gs — verification suite confirming all schema checks pass on live sheet
  - .planning/COLUMN-MAP.md — authoritative A-Z column reference (headers, writers, indices) for all downstream phases
affects:
  - 02-nomination-form
  - 03-referee-form
  - 04-admin-page

# Tech tracking
tech-stack:
  added: [Google Apps Script (ES5), Google Sheets DataValidation, Google Sheets named ranges, Google Sheets conditional formatting]
  patterns:
    - "Single-file Apps Script with public entry point + private _helper functions"
    - "Idempotent setup: clear-then-apply for validation, CF, and named range (safe to re-run)"
    - "ES5 throughout: var, no arrow functions, no template literals"
    - "Named column constants at top of script (COL_STATUS = 19, etc.)"

key-files:
  created:
    - scripts/setup-schema-v2.gs
    - scripts/verify-schema-v2.gs
    - .planning/COLUMN-MAP.md
  modified: []

key-decisions:
  - "BooleanCriteria enum is TEXT_EQUAL_TO, not TEXT_EQ — Apps Script API difference from documentation"
  - "Status validation uses setAllowInvalid(false) so invalid values are rejected, not merely flagged"
  - "ConfirmationDeadline named range at Z1; AA1 holds a human-readable label, Z1 holds the actual date"
  - "Conditional formatting clears all rules before applying, ensuring no v1.0 rules persist"

patterns-established:
  - "COLUMN-MAP.md is the single source of truth for all column references across all phases"
  - "Verify script mirrors setup script header array exactly — any divergence is a bug"
  - "Setup scripts use paste-and-run workflow (no Apps Script CLI); docs describe exact steps"

# Metrics
duration: ~35min (including checkpoint wait and fix iteration)
completed: 2026-03-19
---

# Phase 01 Plan 01: Schema Setup Summary

**v2.0 Google Sheet schema applied: 26-column header row, 3-value status dropdown with rejection enforcement, ConfirmationDeadline named range at Z1, and conditional formatting — all verified passing on live sheet**

## Performance

- **Duration:** ~35 min (including checkpoint pause and fix iteration)
- **Started:** 2026-03-19T21:03:53Z (approx)
- **Completed:** 2026-03-19 (checkpoint approved after fix commit)
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 5 (3 created, 2 deleted)

## Accomplishments

- Wrote `scripts/setup-schema-v2.gs` with `setupSchemaV2()` entry point: rebuilds all 26 headers A-Z in one call, clears data rows, applies 3-value status dropdown with invalid-value rejection, creates `ConfirmationDeadline` named range at Z1, applies 3-rule conditional formatting — all idempotent and ES5
- Wrote `scripts/verify-schema-v2.gs` with `verifySchemaV2()` entry point: 7 independent checks (headers, column count, validation, named range, data rows, CF rules, AA1 label) all confirmed PASS on live sheet
- Produced `.planning/COLUMN-MAP.md` as the authoritative A-Z column reference for all downstream phases, documenting header names, 1-based and 0-based indices, writers, phases, and v1.0 to v2.0 changes
- Removed both v1.0 scripts (`setup-confirmation-columns.gs`, `verify-sheet-structure.gs`); git history preserves them

## Task Commits

Each task was committed atomically:

1. **Task 1: Write setup-schema-v2.gs, verify-schema-v2.gs, COLUMN-MAP.md** - `96660c8` (feat)
2. **Task 2: Remove v1.0 scripts** - `9ac32cd` (chore)
3. **Task 3: Human verification** - checkpoint; fix applied as `7afb978` (fix)

**Plan metadata:** _(pending — this commit)_

## Files Created/Modified

- `scripts/setup-schema-v2.gs` — setupSchemaV2() entry point; full v2.0 schema setup (407 lines, ES5)
- `scripts/verify-schema-v2.gs` — verifySchemaV2() entry point; 7-check verification suite (306 lines, ES5)
- `.planning/COLUMN-MAP.md` — A-Z column reference: headers, writers, indices, named ranges, constants, change log
- `scripts/setup-confirmation-columns.gs` — DELETED (v1.0, replaced)
- `scripts/verify-sheet-structure.gs` — DELETED (v1.0, replaced)

## Decisions Made

- **Status validation enforcement:** Used `setAllowInvalid(false)` so the sheet actually rejects invalid values rather than showing a warning. This ensures downstream scripts can trust column S always contains a valid status.
- **Named range placement:** `ConfirmationDeadline` at Z1 holds the date value; AA1 holds a human-readable "Confirmation Deadline:" label. The named range is what downstream code reads — the label is for human orientation.
- **Idempotent setup pattern:** All setup steps clear existing state before applying (validation cleared, CF cleared, named range existence-checked). Safe to re-run without side effects.
- **BooleanCriteria enum fix:** `TEXT_EQ` does not exist in the Apps Script API — the correct value is `TEXT_EQUAL_TO`. Applied in fix commit 7afb978.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected BooleanCriteria enum in verify script**
- **Found during:** Task 3 (human verification — verify script threw runtime error)
- **Issue:** `verify-schema-v2.gs` used `SpreadsheetApp.DataValidationCriteria.TEXT_EQ` to check the conditional formatting rule type. This enum value does not exist; the correct value is `TEXT_EQUAL_TO`. The script threw an error when run on the live sheet.
- **Fix:** Replaced `TEXT_EQ` with `TEXT_EQUAL_TO` in the two conditional formatting rule checks
- **Files modified:** `scripts/verify-schema-v2.gs`
- **Verification:** User re-ran `verifySchemaV2()` after fix; all 7 checks showed PASS
- **Committed in:** `7afb978` (fix commit during checkpoint)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The bug was in the verification script only — the setup script was correct. No schema changes required. Fix was a 4-line correction. No scope creep.

## Issues Encountered

- Apps Script documentation inconsistency: `BooleanCriteria` enum names in the reference docs did not match actual runtime values. `TEXT_EQ` appeared plausible but does not exist; `TEXT_EQUAL_TO` is correct. Discovered only when the script ran on the live sheet. No workaround needed — correcting the enum value resolved it immediately.

## User Setup Required

None — no external service configuration required. The scripts run in the user's existing Google Apps Script environment on their Google Sheet. The user must paste and run scripts manually (paste-and-run is the established workflow for this project).

**Post-plan action needed:** Enter the actual tournament deadline date in cell Z1 of the production sheet (tracked in STATE.md Pending Todos).

## Next Phase Readiness

- Schema is live and verified on the production Google Sheet
- COLUMN-MAP.md provides the authoritative column reference for Phase 2 (nomination form) and all subsequent phases
- All Phase 1 success criteria met:
  - Column S validation: 3 values, invalid input rejected
  - Column X header: LateFlag (not RefHotel)
  - Column U header: SubmittedAt (not ConfirmedAt)
  - ConfirmationDeadline named range: exists at Z1
  - Column map document: complete A-Z coverage

**Remaining concern before Phase 4:** Column T (SentAt) writer mechanism still TBD — the server never sends email, so auto-write is not straightforward. Must resolve before Phase 4 planning.

---
*Phase: 01-schema-setup*
*Completed: 2026-03-19*
