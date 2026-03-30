# State Cup Referee Nominations

## What This Is

A web-based system for the Tennessee State Cup referee assignment workflow. District Referee Administrators (DRAs) nominate referees by submitting name and email. Each nominee receives an email (sent manually via Outlook) with a unique token-secured link to provide their own availability, age, gender, contact info, hotel needs, and notes. The assignor manages the process through an admin page and uses the Google Sheet as the source of truth for game assignments.

## Core Value

DRAs nominate referees with minimal effort (name + email only), and referees provide their own details directly — giving the assignor accurate, first-hand data to make game assignments.

## Current State

**Shipped:** v2.0 (2026-03-23)
**Status:** Production-ready for Spring State Cup 2026

The complete nomination and detail collection system is built and deployed:
- DRA nomination form with bulk upload at `spring-state-cup-nomination.html`
- Referee detail form with token-secured access at `referee-details.html`
- Assignor email admin page with mailto links at `admin.html`
- Google Apps Script backend (4 .gs files) handling all server logic
- Response deadline set to May 1, 2026

## Requirements

### Validated

- ✓ Simplified DRA nomination form (name + email + max ages + notes per referee) — v2.0
- ✓ DRA form supports spreadsheet upload for bulk nominations — v2.0
- ✓ Token generated at nomination time, reused on re-nomination — v2.0
- ✓ Token-based referee detail links emailed via Outlook mailto — v2.0
- ✓ Referee detail form collects: weekend availability, hotel needs, age, gender, phone, day limitations, notes — v2.0
- ✓ Referee-submitted data writes back to Google Sheet (never appends, always updates) — v2.0
- ✓ Notification emails triggered manually by assignor via mailto links — v2.0
- ✓ Response status tracked in Google Sheet (Not Sent / Sent / Confirmed) — v2.0
- ✓ Referee can edit their response until the deadline — v2.0
- ✓ Late submissions accepted with flag; 3-day grace period before hard close — v2.0
- ✓ Assignor sets response deadline via named range in sheet — v2.0
- ✓ Admin page with sortable/filterable nominee table — v2.0
- ✓ XSS protection, SRI, honeypot, file size limits — v2.0
- ✓ Mobile-responsive referee form (16px min font, 44px touch targets) — v2.0
- ✓ Parent/guardian email field for minor referees (age < 18) — v2.0
- ✓ Server-side validation and LockService concurrency guards — v2.0

### Active

- [ ] Re-send capability for Not Sent referees — individual mailto links filtered to those never emailed
- [ ] Batch reminder to non-responders — single BCC mailto to all referees who received email but haven't submitted
- [ ] DRA nominee view page — DRA selects their name, sees their nominees with name, status, and referee-submitted details

### Out of Scope

- Login/authentication system — token-in-URL approach is sufficient; security isn't a major concern
- Automated emails on nomination submit — assignor triggers emails manually
- Dashboard for tracking responses — spreadsheet columns are sufficient
- Game assignment tool — this system handles nominations and referee details only
- SMS / push notifications — email-only workflow
- In-email one-click response — email client prefetch breaks GET-with-side-effects

## Workflow (v2.0)

1. **DRA nominates** — Submits referee name + email via simplified form → row created in sheet with token
2. **Assignor sends emails** — Opens admin page, clicks mailto links to send nomination/detail-request emails via Outlook
3. **Referee provides details** — Opens token-secured link, fills out comprehensive form (availability, age, gender, contact, hotel, notes)
4. **Assignor reviews** — Sheet has all referee-provided data for game assignments

## Context

- **Hosting:** GitHub Pages (static site) at `615jess.github.io/statecup-refnoms/`
- **Data store:** Google Sheets via Apps Script web app endpoints
- **Architecture:** All server-side logic in Google Apps Script (4 files). HTML/JS is purely client-side (3 pages). No build tools or frameworks.
- **Email:** Assignor uses Microsoft 365/Outlook — emails sent via mailto links, not MailApp/GmailApp
- **Schema:** 28-column Google Sheet (A-AB) with named range ConfirmationDeadline at Z1
- **Users:** 7 DRAs submitting nominations, ~50-100 referees responding, 1 assignor managing the process
- **Tournament dates:** Weekend 1: May 16-17, 2026. Weekend 2: May 23-24, 2026
- **Response deadline:** May 1, 2026
- **Codebase:** ~4,600 LOC across 9 deliverable files (Apps Script ES5 + HTML/CSS/JS)

## Constraints

- **Hosting:** GitHub Pages — static files only, no server-side rendering or API routes
- **Backend:** Google Apps Script — all server logic and sheet manipulation
- **Design:** Open Sans, navy/red/gold color scheme across all pages
- **Simplicity:** Single-page HTML files with inline CSS/JS, no build tools or frameworks
- **Apps Script:** Requires new deployment per code change — cannot update existing deployment in-place

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Pivot from DRA-provides-all to referee-provides-own-details | Less work for DRAs, more accurate data from referees, eliminates redundant confirmation step | ✓ Shipped v2.0 |
| Token-in-URL for referee identity | Simplest approach, no login needed, prevents uninvited submissions | ✓ Shipped v2.0 |
| Mailto links for email (not MailApp) | Assignor uses Microsoft 365/Outlook | ✓ Shipped v2.0 |
| Spreadsheet columns for status tracking | Assignor already works in the sheet, no need for separate dashboard | ✓ Shipped v2.0 |
| Manual email trigger | Assignor wants control over when emails go out | ✓ Shipped v2.0 |
| Late submissions allowed with 3-day grace period | Referee sees a notice; assignor sees the late flag in the sheet | ✓ Shipped v2.0 |
| Reuse existing token for re-nominated referees | Same referee always has the same link — less confusion | ✓ Shipped v2.0 |
| Referee can edit until deadline, then read-only | Edits allowed before deadline; read-only after | ✓ Shipped v2.0 |
| Apps Script new deployment per code change | Cannot update existing deployment in-place; form URLs updated after each deploy | ✓ Documented |
| Parent/guardian email for minors | Safety requirement — assignor needs emergency contact for referees under 18 | ✓ Shipped v2.0 |

## Current Milestone: v2.1 Communication & DRA Visibility

**Goal:** Improve assignor email workflow and give DRAs visibility into their nominees' response status and details.

**Target features:**
- Re-send to Not Sent referees (filtered individual mailto links on admin page)
- Batch reminder to non-responders (single BCC mailto for follow-up)
- DRA nominee view (new page — DRA selects name, sees their nominees with status and details)

## Future Possibilities

- Sheet summary formula showing Not Sent / Sent / Confirmed counts
- Batch "mark all as sent" for emails sent outside admin page
- Microsoft Graph API integration for creating Outlook drafts directly

---
*Last updated: 2026-03-30 after v2.1 milestone start*
