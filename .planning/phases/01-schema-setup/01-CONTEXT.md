# Phase 1: Schema Setup - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Rework the Google Sheet column structure for v2.0: apply new status values, rename headers, set up named ranges, remove v1.0 code, and produce a verified column map document that all subsequent phases build on.

</domain>

<decisions>
## Implementation Decisions

### Existing data handling
- Sheet is essentially empty — no real v1.0 nominations to migrate
- Clear any test/leftover rows and start fresh — only headers remain after setup
- Column S validation: remove old v1.0 values (Confirmed/Declined), apply v2.0 values (Not Sent / Sent / Confirmed) in one step — no migration logging needed

### Header row approach
- Rebuild the entire header row from a single defined array (A-Z) rather than surgically updating individual columns
- Guarantees consistency regardless of current sheet state

### Column map deliverable
- Lives in `.planning/COLUMN-MAP.md` — accessible to all downstream agents
- Named ranges included in the same document (organization at Claude's discretion)
- Level of detail at Claude's discretion — enough for downstream agents to work without ambiguity

### Production sheet state
- Script execution: run manually from the Apps Script editor (paste and run)
- Spreadsheet ID is already defined in the existing Apps Script project
- Idempotency and dev/test sheet strategy at Claude's discretion

### v1.0 form compatibility
- v1.0 form is NOT in active use — no DRAs submitting through it
- Free to break v1.0 compatibility — no backward compat needed
- Roadmap success criteria #4 ("v1.0 form still writes correctly") is dropped
- Remove v1.0 code in Phase 1 as part of clean-slate setup — subsequent phases start fresh
- Claude reviews v1.0 code and decides what patterns (if any) are worth carrying forward; git history serves as reference

### Claude's Discretion
- Script idempotency approach (whether to handle v1.0-applied vs not-applied sheet states)
- Whether to recommend a dev/test sheet alongside production
- Column map detail level (at minimum: column letter, index, header, writer)
- Named range organization within the column map document
- Verification approach (script self-check vs manual)
- Which v1.0 code patterns to carry forward vs discard

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-schema-setup*
*Context gathered: 2026-03-19*
