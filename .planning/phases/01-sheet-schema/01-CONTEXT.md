# Phase 1: Sheet Schema - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Append columns R-Y to the Google Sheet with correct headers and default values. Verify that the existing nomination form (custom doPost writing to columns A-Q) continues working without errors. Add a named cell for the tournament confirmation deadline. This phase touches only the sheet structure — no Apps Script logic changes, no HTML pages.

</domain>

<decisions>
## Implementation Decisions

### Status lifecycle
- Four status values: Not Sent, Pending, Confirmed, Declined
- "Confirmed" means the referee submitted the form, regardless of per-weekend choices (even if they declined one weekend)
- "Declined" only if the referee explicitly declines all weekends
- Referees can re-submit and update their response until a single tournament-wide deadline
- After the deadline, the confirmation link shows read-only data

### Column defaults & validation
- Column S (Status) gets a dropdown data validation restricting to the four status values
- Existing rows backfilled with "Not Sent" in column S — Claude's discretion on whether to also pre-generate tokens (column R) for existing rows
- Weekend response columns (V-W: RefWeekend1, RefWeekend2) use "Confirmed" / "Declined" as values
- Tournament confirmation deadline stored in a named cell in the sheet (visible to assignor, accessible to Apps Script and confirmation page)

### Verification approach
- Work on a test copy of the spreadsheet first, then apply to production
- Verify with both: a script-based check that submits test data and asserts A-Q correctness, plus a manual test submission through the form
- Spot-check a few existing rows before/after to confirm no data shifted (under 50 rows total, so visual scan is feasible)
- Nomination form uses custom doPost (not onFormSubmit) — verification must exercise the doPost path

### Claude's Discretion
- Whether to pre-generate tokens for existing rows during backfill or defer to Phase 4
- Column widths, header formatting, and any conditional formatting
- Date format for SentAt/ConfirmedAt columns
- Exact placement and naming of the deadline cell/named range
- Error state handling in the verification script

</decisions>

<specifics>
## Specific Ideas

- Under 50 existing nomination rows — backfill and spot-check can be done manually if needed
- Assignor will create a test copy of the sheet for development; apply changes to production after verification passes

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-sheet-schema*
*Context gathered: 2026-03-18*
