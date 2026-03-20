# Phase 4: Email Admin Page + getAllNominees - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Assignor-facing admin page that loads all nominees from the sheet, displays them in a sortable/filterable table, and provides pre-composed mailto links to send personalized emails via Outlook. Clicking a mailto link auto-marks the referee's status as Sent. The referee detail form (Phase 3) and DRA nomination form (Phase 2) are already complete — this phase only builds the admin view and the getAllNominees endpoint.

</domain>

<decisions>
## Implementation Decisions

### Email body content
- Professional formal tone: "Dear [Name], You have been nominated to officiate..."
- Generic subject line: "State Cup Referee Nomination — Action Required" (not personalized with referee name)
- Body includes all four: tournament name & dates, DRA who nominated them, assignor contact info, and response deadline
- Body must stay under 1800 characters (mailto URL limit)
- Assignor can edit the email in Outlook before sending (inherent to mailto — not a constraint we impose)

### Nominee table layout
- Columns: Name, Email, DRA, Status, Weekend Availability (Weekend 1 / Weekend 2 from submitted details)
- Match the visual style of existing DRA nomination form and referee detail form (same color palette, fonts, card-based styling)

### Mailto click flow
- Auto-mark on click: JavaScript fires an API call to mark status=Sent the moment the mailto link is clicked (before Outlook opens)
- SentAt timestamp (column T) written by the same API call that marks status=Sent — resolves the STATE.md blocker
- No undo option needed — accidental clicks aren't a concern (assignor can close Outlook without sending)

### Filtering & workflow
- Sortable table: clickable column headers to sort ascending/descending
- Default sort: Not Sent first, then Sent, then Confirmed — actionable items surface at top
- Search box above the table to filter rows by name or email as you type

### Claude's Discretion
- Status visual treatment (colored badges, row highlighting, etc.)
- Whether to include summary counts at top (e.g., "12 Not Sent / 8 Sent / 5 Confirmed")
- Filter mechanism style (tabs vs dropdown vs other)
- In-place row update vs page reload after marking Sent

</decisions>

<specifics>
## Specific Ideas

- Assignor uses Microsoft 365/Outlook — mailto links must open correctly in that environment
- Email body references: tournament name, weekend dates, DRA name, assignor contact, response deadline, and the token-secured referee form link
- The page is a static HTML file hosted on GitHub Pages (ADMIN-01), fetching data from the Apps Script doGet endpoint

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-email-admin-page*
*Context gathered: 2026-03-20*
