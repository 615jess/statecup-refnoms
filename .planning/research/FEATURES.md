# Features Research: Referee Confirmation System

**Domain:** Email-based RSVP / availability confirmation for a small-scale sports event
**Project:** State Cup Referee Nominations — Tennessee Soccer
**Researched:** 2026-03-17
**Confidence:** HIGH for confirmation system patterns (well-established domain); MEDIUM for Google Apps Script specifics where not verified via Context7

---

## Context: What We Are Building

A referee receives an email, clicks a link, lands on a pre-filled web page, confirms or adjusts their availability for two tournament weekends, and submits. That response writes back to the assignor's Google Sheet.

- ~50–100 referees receiving one confirmation email each
- 1 assignor triggering emails and tracking responses
- No login — token-in-URL is the identity mechanism
- Backend: Google Apps Script only (no server-side rendering, no external services)
- Frontend: static HTML on GitHub Pages

Understanding what "good" looks like in this domain requires separating what makes the system function (table stakes) from what makes it noticeably better than a plain email asking referees to reply (differentiators), and what to deliberately avoid so scope stays under control (anti-features).

---

## Table Stakes

Features the confirmation system cannot function without. Absent any of these, the referee either cannot complete the task, or the assignor gets unreliable data.

| Feature | Why Expected | Complexity | Notes / Dependencies |
|---------|--------------|------------|----------------------|
| Unique token per referee in the confirmation URL | Identifies who is responding without requiring a login. Without this, responses cannot be attributed to individuals. | Low — Apps Script generates a UUID, stores it in the sheet row, appends it to the link | Token must be stored in the sheet before emails are sent |
| Confirmation email with referee name and clear CTA | Referee must know the email is for them and what action to take. Generic emails get ignored or generate "which one is me?" replies to the assignor. | Low — MailApp template with basic personalization | Requires referee email address in sheet |
| Pre-filled confirmation form showing current nomination data | Referees should not have to re-enter data already submitted by their DRA. Pre-filling reduces friction and errors. If the form is blank, referees guess or skip fields. | Medium — confirmation page fetches data via GET + token, then populates fields | Depends on GET endpoint in Apps Script returning referee row by token |
| Ability to confirm or decline each nominated weekend independently | The core action. Weekend 1 and Weekend 2 are separate events; a referee may be available for one but not the other. The form must reflect this granularity. | Low — two checkboxes or radio groups, same pattern as nomination form | Must match the availability model already in the sheet |
| Ability to update hotel needs per weekend | Hotel accommodation is tracked per weekend in the existing sheet. If a referee's hotel need changes after nomination, the confirmation is the right place to update it. | Low — same hotel checkbox pattern from nomination form, shown conditionally per weekend | Mirrors existing nomination form hotel UI |
| Ability to add free-text notes to the assignor | Referees often have constraints that don't fit structured fields: "I can work Saturday but must leave by 3pm," "I'll be driving from Knoxville and might arrive late." A notes field captures this without requiring additional fields. | Low — single textarea | No dependency |
| Confirmation submission writes back to Google Sheet | The entire purpose of the system. If responses don't reach the sheet, the assignor is managing confirmation status manually via email thread. | Medium — POST to Apps Script endpoint that updates the existing referee row by token | Requires the Apps Script to find the row by token and update specific columns |
| Confirmation status column visible to assignor | Assignor needs to know who has responded, who is pending, and who declined — at a glance, in the sheet they already work in. | Low — Apps Script writes a status value (Pending / Confirmed / Declined / Partial) when emails are sent and when confirmations arrive | Status is a sheet column alongside existing data |
| Success/failure feedback after submission | Referees must know whether their confirmation was received. Without this, they'll email the assignor asking "did you get my response?" | Low — success screen after POST completes, error message with retry if POST fails | Standard pattern from existing nomination form |
| Mobile-friendly confirmation page | The majority of referees will open the email on a phone. If the page is not usable on mobile, confirmation rates drop and the assignor receives confused replies. | Medium — requires touch-friendly form controls, readable font sizes without zooming, single-column layout on small screens | Existing nomination form already has mobile CSS patterns to reuse |
| Link expiry or idempotent re-submission | A referee clicking the link a second time to check what they submitted should not create a duplicate or overwrite a confirmed status with blank data. The form should load their most recent confirmed data (not a blank form). | Medium — Apps Script GET returns current sheet data; form pre-fills with it; re-submission updates same row | Token-based row lookup naturally handles this |

---

## Differentiators

Features that go beyond bare functionality. None are required for the system to work, but each addresses a real friction point for either the referee (experience) or the assignor (visibility). Given the small scale (~50–100 referees, one assignor), the bar for "worth building" is high — only include things that meaningfully improve over a plain-email workflow.

| Feature | Value Proposition | Complexity | Notes / Dependencies |
|---------|-------------------|------------|----------------------|
| Personalized email subject line including referee name and tournament | "State Cup Confirmation — Jane Smith" vs "State Cup Confirmation." Referees who share an email account (family, coach) can distinguish their email. Improves open rates for a low-effort addition. | Low — template variable in MailApp subject | No additional dependency |
| Summary of what the referee confirmed, shown on the success screen | After submitting, show back the specific weekends confirmed and hotel needs. "You confirmed: Weekend 1 (May 16–17), hotel needed. Weekend 2 (May 23–24), no hotel." This prevents "I'm not sure if I submitted correctly" follow-up emails to the assignor. | Low — client-side, no server round-trip needed | Can be assembled from the submitted form data before the POST |
| "Reply to assignor" email address in the confirmation email | If a referee has a question they cannot answer in the form ("I might be available but I'm not sure"), they should have a direct contact. Include the assignor's email address in the email body, not just in the From field. | Low — static text in email template | |
| Assignor progress indicator in the sheet: count of Confirmed / Pending / Declined | A formula or Apps Script function that keeps running totals visible at the top of the sheet. "17 confirmed, 31 pending, 4 declined" is more useful than scrolling through rows. | Low — can be a COUNTIF formula in a summary area, no code required | Depends on consistent status values in the confirmation status column |
| Re-open confirmation form for a referee who needs to change their response | If a confirmed referee later needs to update their availability (injured, conflict arose), the token link still works and they can resubmit. The form should load their current data, let them edit, and resubmit. Status updates to "Updated" or back to "Confirmed." | Low — naturally supported by the token/GET/POST flow if the POST is an upsert not an insert | No additional code required if the Apps Script does row-update not row-append |
| Clear expiry messaging if confirmations have closed | When the assignor closes confirmations, a referee clicking an old link should see a friendly message ("Confirmations are now closed. Contact [assignor] with questions.") rather than a broken form or silent failure. | Low — Apps Script checks a "confirmations open" flag before processing; returns a closed message | Requires a "closed" state flag, either a sheet cell or a script property |
| Distinct visual confirmation states in the email CTA | Rather than a single generic "Confirm Availability" button, the email body briefly lists the weekends the referee was nominated for: "You were nominated for Weekend 1 (May 16–17) and Weekend 2 (May 23–24). Click below to confirm." Reduces "I don't know what I'm confirming" calls. | Low — templated email body with referee's nominated weekends listed | Requires the availability data to be available when sending emails, which it already is in the sheet |

---

## Anti-Features

Things to deliberately not build. Each represents scope creep or unnecessary complexity for this specific context (50–100 referees, one assignor, ~6-week lifecycle, one-time annual event).

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Automated email sending on nomination submit | The assignor explicitly wants control over when emails go out. They may need to review nominations, fix missing email addresses, or coordinate timing with the SRA/SYRA before referees are notified. Automating this removes that control. | Keep email trigger as a manual step: assignor runs a function (or clicks a button) when ready |
| Email reminders / automated follow-up scheduling | Adds significant complexity (cron-like triggers, state tracking, unsubscribe handling). For ~50–100 referees with a manual-trigger model, the assignor can simply re-send to non-responders by hand, or re-run the send function targeting only Pending rows. | Assignor manually identifies Pending rows in the sheet and re-triggers email for those referees |
| Dashboard separate from the Google Sheet | The assignor already works in the sheet. A separate tracking dashboard means maintaining two views of the same data. The sheet is the source of truth; keep tracking there via status columns and optional summary formulas. | Add a Confirmation Status column to the existing sheet |
| Login / authentication | This is a one-off annual form for known, vetted referees. The data (name, availability, hotel preference) is low-sensitivity. Token-in-URL matches the security requirement without adding login UX, password resets, or session management. | Token-in-URL approach |
| Full withdrawal / opt-out flow | Declining both weekends via the confirmation form is an edge case that should be handled with a phone call between the referee and their DRA, not a self-service UI. If a referee genuinely needs to withdraw, the DRA should be involved — that's outside the confirmation form's scope. | The form lets referees decline individual weekends; full withdrawal is out of scope |
| Referee profile / history across years | Carry-forward data from prior tournaments adds persistence complexity. Each State Cup is a fresh nomination cycle. Data from prior years isn't needed for assignment decisions. | Start fresh each tournament cycle |
| Email open / click tracking | Pixel tracking and click analytics require an external service (SendGrid, Mailchimp, etc.) or custom redirect infrastructure. For this scale, "did they submit the form?" is the only tracking that matters, and the sheet already captures that. | Use the Confirmation Status column as the only engagement signal |
| In-email confirmation (clicking Yes/No directly in the email without loading a page) | Sometimes called one-click RSVP. Requires server-side handling of GET requests with side effects, which is possible in Apps Script but fragile: email clients prefetch links (breaking single-click responses), and there's no opportunity to review/edit data before confirming. | Always direct to the confirmation page so referees can review pre-filled data |
| SMS / push notifications | Small scale, short event cycle, existing referee contact is via email. Adding another notification channel multiplies complexity without clear benefit. | Email only |
| Bulk-action confirmation page for assignor | "Confirm all pending referees" type admin UI. For ~50–100 referees, granular per-person email sending is workable and gives the assignor appropriate oversight. | Assignor manages per-referee status in the sheet |

---

## Feature Dependencies

```
Token generation
  └─> Email sending (token must exist before email is sent)
        └─> Confirmation form (link contains token)
              └─> GET endpoint (fetches data by token)
              │     └─> Pre-filled form
              └─> POST endpoint (updates row by token)
                    └─> Confirmation Status column update
                    └─> Success screen
```

Hotel checkboxes on confirmation form depend on weekend availability checkboxes (hotel only shows when weekend is selected — same interaction pattern as the nomination form).

Closing confirmations depends on a "closed" flag the assignor can set; the GET endpoint should respect this flag before returning data.

---

## Confirmation States

The sheet needs to track one status value per referee row. Four states cover all scenarios:

| Status | Meaning | Set When |
|--------|---------|----------|
| Pending | Email sent, no response yet | Apps Script writes this when sending the confirmation email |
| Confirmed | Referee submitted the form and confirmed at least one weekend | POST endpoint writes this on successful submission where at least one weekend is confirmed |
| Declined | Referee submitted the form and declined all nominated weekends | POST endpoint writes this on successful submission where no weekends are confirmed |
| Not Sent | Default state; email not yet sent | Initial state for all rows before email trigger runs |

A "Partial" state (confirmed one weekend, declined the other) could be useful but adds assignor cognitive load. The Availability column already captures the specific weekends — the assignor can see the detail there. Keep the status to four simple values.

---

## Email Content Requirements

What the confirmation email must contain to be actionable:

**Required:**
- Referee's name (personalization — confirms the email is theirs)
- Tournament name and dates ("Spring State Cup 2026, May 16–17 and May 23–24")
- Which weekends the referee was nominated for (pulled from their sheet row)
- Single prominent CTA link to the confirmation form
- Assignor contact information for questions
- Brief instruction: what the referee should do ("Review your availability below and click Confirm to let us know you're in")

**Not required (keep it simple):**
- HTML email with logos and styling (plain text is fine; adds no value for this workflow)
- Unsubscribe link (not a marketing email; referee opted into the process by being nominated)
- Multiple links or buttons

---

## Confirmation Form UX Requirements

What the confirmation page must do:

**On load:**
- Display referee name prominently (confirms they're on the right page)
- Show tournament name and dates
- Pre-fill weekend availability checkboxes matching current sheet data
- Pre-fill hotel checkboxes matching current sheet data
- Show existing notes in the textarea (if any were entered at nomination time)
- If link is for a referee who already confirmed, show a banner: "You previously confirmed on [date]. You can update below and resubmit."

**Form fields:**
- Weekend 1 availability: confirm / not available (checkbox or two-option selector)
- Weekend 1 hotel: needs room / no hotel (conditional — only shown if Weekend 1 is checked)
- Weekend 2 availability: confirm / not available
- Weekend 2 hotel: needs room / no hotel (conditional)
- Notes to assignor: free-text textarea
- Submit button

**On submit:**
- Disable button during POST to prevent double-submission
- Show spinner / loading state
- On success: clear success screen summarizing what was submitted
- On failure: error message with retry; include assignor email so referee can contact directly if stuck

**Mobile requirements:**
- Minimum 16px body font (prevents iOS auto-zoom on input focus)
- Touch targets minimum 44px tall (WCAG 2.5.5)
- Single-column layout on screens under 560px (same breakpoint as nomination form)
- Hotel checkboxes must be large enough to tap without precision (use the existing hotel-input pattern from the nomination form, but consider larger tap target for the label)
- Page should not require horizontal scrolling at any common phone width (320px–428px)
- CTA button full-width on mobile

---

## Assignor Workflow Requirements

What the assignor needs to do their job:

1. **Send emails** — trigger confirmation emails for all nominees (or a filtered subset). Should be runnable from within the Google Sheet via a custom menu item or from Apps Script directly. Does not need to be a web UI.
2. **Track responses** — Confirmation Status column shows Pending / Confirmed / Declined / Not Sent per row. Assignor scans the sheet normally.
3. **Re-send to non-responders** — Assignor identifies Pending rows manually and re-triggers the email function. No automation required.
4. **Close confirmations** — Assignor sets a flag when ready to stop accepting responses. A clear mechanism (a sheet cell value, or a script property) is sufficient.
5. **No new UI required** — all assignor actions happen in the Google Sheet or via Apps Script functions. A custom Google Sheet menu is sufficient.

---

## MVP Recommendation

For v1.0, build exactly the table stakes. Every differentiator is low-complexity and can be included, but if scope pressure arises, cut in this order (last to cut first):

**Must have (table stakes — do not cut):**
1. Token generation and storage per referee row
2. Confirmation email with referee name, tournament dates, and confirmation link
3. Confirmation page: GET endpoint + pre-filled form
4. Confirmation form: weekend availability, hotel, notes
5. POST endpoint: writes back to sheet row, updates status column
6. Success/error feedback after submission
7. Mobile-responsive confirmation page

**Can add after table stakes are working (differentiators worth including):**
8. Personalized email subject line with referee name
9. Email body listing the specific nominated weekends
10. Success screen summary of what was submitted
11. "Reply to assignor" contact in email
12. Closed-confirmation messaging for expired links
13. Assignor sheet summary formula (COUNTIF — zero code, just formula)

**Explicitly not in v1.0 (anti-features — do not build):**
- Automated reminder emails
- Separate tracking dashboard
- Full opt-out flow
- In-email one-click confirmation

---

## Sources and Confidence

This research is based on well-established patterns in email-based RSVP and availability confirmation systems, cross-referenced with the specific constraints of this project as documented in PROJECT.md.

| Area | Confidence | Basis |
|------|------------|-------|
| Confirmation system patterns (token-URL, states, form UX) | HIGH | Well-established domain; consistent across email services, event systems, and sports scheduling tools |
| Mobile UX requirements | HIGH | iOS auto-zoom behavior, WCAG touch target sizing are documented standards |
| Google Apps Script capabilities (MailApp, sheet row update) | MEDIUM | Based on training knowledge of Apps Script; verify specific API calls during implementation |
| Assignor workflow fit | HIGH | Derived directly from PROJECT.md requirements and constraints |
| Scale estimates (50–100 referees) | HIGH | Stated in PROJECT.md |
