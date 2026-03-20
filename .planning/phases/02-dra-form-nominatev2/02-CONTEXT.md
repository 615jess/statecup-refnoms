# Phase 2: DRA Form + nominateV2 - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

A DRA can submit referee nominations (individually or via spreadsheet upload) and each nomination creates exactly one sheet row with a token, leaving referee-detail columns blank — ready for the referee to fill. This phase delivers the simplified DRA nomination form and the nominateV2 doPost handler. The referee detail form (Phase 3) and email admin page (Phase 4) are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Form field set
- **6 fields per referee:** first name (required), last name (required), email (required), max age as AR (required), max age as referee (required), DRA notes (optional free-text textarea)
- **Age dropdowns:** U12, U13, U14, U15, U16, U17, U18, U19 — yearly increments, no Adult/Open option
- **Removed from v1.0:** phone, referee age, weekend availability, hotel needs, day-specific limitations — all move to referee form (Phase 3)
- **DRA identity:** Keep hardcoded dropdown with auto-fill for district and email. Add Don Eubank, Mark Herrington (SRA), the SYRA, and the Assignor to the existing 7 DRAs (need email/district details at implementation time)

### Spreadsheet upload
- **Keep upload with simplified template** — fewer columns matching the 6-field set
- **Template download stays** — button generates a pre-formatted template with example row
- **Upload appends** to any existing manual entries (v1.0 replaced; v2.0 allows mixing upload + manual in one submission)
- **SheetJS vs CSV-only:** Claude's discretion

### Duplicate handling
- **Cross-DRA dedup by email** — one row per referee email, regardless of which DRA nominates. Second submission updates the existing row
- **Only DRA columns updated** — nominateV2 only writes columns A-H and Q. Never overwrites referee-provided data in I-P. Existing token in R is preserved
- **Within-upload duplicates (same email twice in one spreadsheet):** Claude's discretion

### Submission feedback
- **Summary like v1.0** — green success box listing each nominee by name and key details
- **Backend returns new vs. updated status** per nominee — summary shows "Jane Smith (new)" vs "John Doe (updated)"
- **Error state includes assignor email** for direct contact fallback (same as v1.0)

### Claude's Discretion
- SheetJS vs CSV-only for spreadsheet parsing
- Within-upload duplicate handling (same email appearing twice in one spreadsheet)
- Post-submission form state (reset with "Submit More" button vs. summary-only final state)
- Upload zone visual design and drag-and-drop behavior
- Loading/spinner states during submission

</decisions>

<specifics>
## Specific Ideas

- Keep the same visual style as v1.0 form (Open Sans, navy/red/gold color scheme, card-based sections)
- DRA dropdown pattern works well — auto-filling district and email reduces errors
- The "or add manually" divider pattern from v1.0 works with the append behavior (upload adds to manual entries, not replaces)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-dra-form-nominatev2*
*Context gathered: 2026-03-19*
