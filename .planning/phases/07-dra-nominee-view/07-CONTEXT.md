# Phase 7: DRA Nominee View - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

A DRA can visit a dedicated page, select their name from a dropdown, and see a read-only table of all their nominees with full response details. The nomination form links them there. No editing, no submitting — view-only.

</domain>

<decisions>
## Implementation Decisions

### Table content & density
- Compact + expandable row layout — not all columns flat
- Compact row shows: referee name and response status only
- Expanded view shows referee-submitted details: availability, hotel, age, gender, phone, notes
- Do NOT show email address in expanded details — DRA already knows the email they provided
- Expanded detail format: Claude's discretion (labeled list vs mini sub-table)

### Status presentation
- Simplified status labels for DRA audience: "Responded" or "Pending" — not the admin statuses (Not Sent, Sent, Complete)
- Visual treatment of status badges: Claude's discretion (colored badge, icon + text, etc.)
- Summary count at the top of the table (e.g., "5 nominees — 3 responded, 2 pending")
- Behavior for expanding pending referees: Claude's discretion

### Link placement & page context
- Link to DRA nominee view appears at the top of the nomination form (above form fields)
- Link text: "Review your nominees"
- Page header: simple title (e.g., "Your Nominees") — clean and minimal
- Browser remembers last DRA selection via local storage, auto-loads their nominees on return

### Claude's Discretion
- Expanded detail format (labeled list vs sub-table)
- Status visual treatment (colored badges, icons, etc.)
- Pending referee expanded state behavior
- Empty state when DRA has no nominees
- Exact page styling and spacing

</decisions>

<specifics>
## Specific Ideas

- Summary count gives DRAs at-a-glance progress without scanning every row
- Compact rows keep the page clean — DRAs only drill into details when they need them
- Remembering DRA selection reduces friction for repeat visits

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-dra-nominee-view*
*Context gathered: 2026-03-30*
