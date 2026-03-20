# Phase 3: Referee Detail Form + Backend - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

A referee opens their token-secured link, sees tournament context and a personalized greeting, fills out availability and contact details, submits, and can return to edit until the deadline. The form enforces deadline states (open, late with banner, hard-closed). The backend handles token lookup (doGet getDetails) and row updates (doPost submitDetails) with deadline enforcement and late flagging. Creating/sending the email with the token link is Phase 4 — this phase only builds the form and endpoints the link points to.

</domain>

<decisions>
## Implementation Decisions

### Weekend Availability Input
- Simple Yes/No toggle per weekend (not day-level checkboxes)
- RefWeekend1 (V) and RefWeekend2 (W) column values: Claude's discretion on exact text
- Column M (Availability): Claude's discretion — may hold a summary string or stay empty
- If referee says No to both weekends: show a warning confirmation ("You indicated you're not available either weekend — are you sure?") but allow submission

### Hotel Logic
- Hotel question only appears for weekends the referee marked available
- If Weekend 1 = No, the Weekend 1 hotel question is hidden (and vice versa)

### Day-Specific Limitations
- No dedicated field — limitations are merged into RefNotes (Y)
- Referee uses the notes textarea to mention any day-specific constraints

### Form Layout & Structure
- Claude's discretion on single-page cards vs other layout
- Must match DRA form visual style: same header with logos, topbar gradient, navy/red/gold scheme, Open Sans font
- Personalized greeting using referee's first name (e.g., "Hi Jesse, Don Eubank has nominated you...")
- Tournament context (dates, DRA name, assignor contact) displayed prominently before form fields

### Gender Collection
- Three options: Male / Female / Non-binary
- Dropdown or radio buttons (Claude's discretion)

### Deadline & Late Submission
- One deadline date in sheet (ConfirmationDeadline named range at Z1)
- 3-day grace period after deadline before hard close
- During grace period: late submissions accepted, LateFlag = Y written to column X
- Late notice: yellow/orange warning banner at top of form ("The deadline was [date]. You can still submit, but your response will be marked as late.")
- Referees who already submitted CAN still edit during the grace period (not locked to read-only)
- Late flag only applies to first-time submissions after deadline (edits to existing submissions during grace don't add a late flag if they submitted on time originally)

### Hard-Close State
- After deadline + 3 days: form is completely closed
- Show friendly message: "Responses for this tournament have closed" + assignor contact email
- No form fields visible, no submission possible
- No read-only summary of their data — just the closed message

### Post-Submission Experience
- Success state: Claude's discretion (inline summary or toast)
- Re-visiting token link after submission: pre-filled editable form (not read-only summary)
- Submit button is context-aware: "Submit Details" on first visit, "Update Details" on return visit

### Claude's Discretion
- Form structure (single-page cards vs sections vs other)
- Tournament context presentation style (banner, greeting card, etc.)
- Column M (Availability) usage — summary string or leave empty
- RefWeekend1/2 column values (exact text for Yes/No)
- Success state design after submission
- Loading skeleton / spinner design
- Exact spacing, typography, card styling
- Error state design (invalid token, server error)

</decisions>

<specifics>
## Specific Ideas

- Match the DRA form's exact visual style (header with logos, topbar gradient, navy/red/gold, Open Sans)
- Personalized greeting: "Hi [First Name]" — confirms correct link and feels personal
- Late banner modeled after a warning alert: yellow/orange with deadline date shown
- Hard-close screen is minimal and friendly — not an error page, just a polite closure with assignor contact

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-referee-detail-form*
*Context gathered: 2026-03-20*
