# State Cup Referee Nominations

## What This Is

A web-based system for the Tennessee State Cup referee assignment workflow. District Referee Administrators (DRAs) nominate referees for the Spring State Cup tournament by submitting just the referee's name and email. Each nominated referee then receives an email congratulating them on their nomination and containing a unique token-secured link where they provide their own availability, age, gender, contact information, hotel needs, and notes. The SRA, SYRA, and State Cup Assignor use the Google Sheet as the source of truth for game assignments.

## Core Value

DRAs nominate referees with minimal effort (name + email only), and referees provide their own details directly — giving the assignor accurate, first-hand data to make game assignments.

## Requirements

### Validated

- ✓ DRA nomination form with spreadsheet upload support — existing (will be simplified)
- ✓ Form writes referee nominations to Google Sheet — existing
- ✓ XSS protection, SRI, honeypot, file size limits — existing
- ✓ Server-side validation in Apps Script — existing

### Active

- [ ] Simplified DRA nomination form (name + email per referee only)
- [ ] Token-based referee detail links emailed to nominees (no login required)
- [ ] Referee detail form collects: weekend availability, hotel needs, age, gender, contact info, day limitations, notes
- [ ] Referee-submitted data writes back to the Google Sheet
- [ ] Notification emails triggered manually by assignor via mailto links (opens Outlook)
- [ ] Response status tracked in Google Sheet (Not Sent/Pending/Completed)
- [ ] Referee can edit their response until the deadline
- [ ] Late submissions accepted with a flag; referee sees a notice
- [ ] Assignor can set a response deadline

### Out of Scope

- Login/authentication system — token-in-URL approach is sufficient; security isn't a major concern
- Automated emails on nomination submit — assignor triggers emails manually
- Dashboard for tracking responses — spreadsheet columns are sufficient
- Game assignment tool — this system handles nominations and referee details only

## Workflow (v2.0)

1. **DRA nominates** — Submits referee name + email via simplified form → row created in sheet with token
2. **Assignor sends emails** — Opens admin page, clicks mailto links to send nomination/detail-request emails via Outlook
3. **Referee provides details** — Opens token-secured link, fills out comprehensive form (availability, age, gender, contact, hotel, notes)
4. **Assignor reviews** — Sheet has all referee-provided data for game assignments

## Current Milestone: v2.0 Referee Nomination & Detail Collection

**Goal:** Simplify the DRA nomination process to name + email, then collect all referee details directly from the referees via token-secured forms.

**Target features:**
- Simplified DRA nomination (name + email only)
- Token-based referee detail collection links
- Comprehensive referee form (availability, age, gender, contact, hotel, notes)
- Response status tracking in Google Sheet
- Assignor email admin page with mailto links
- Response deadline with late-submission handling

## Context

- **Hosting:** GitHub Pages (static site). No server-side backend except Google Apps Script.
- **Data store:** Google Sheets via Apps Script web app endpoints.
- **Architecture constraint:** All server-side logic must live in Google Apps Script. The HTML/JS is purely client-side.
- **Email:** Assignor uses Microsoft 365/Outlook — emails sent via mailto links, not MailApp/GmailApp.
- **Token approach:** Apps Script generates a unique token per referee row, stored in the sheet. Detail-request link includes token as URL param. Referee form fetches their row data via GET request with token.
- **Referee emails:** Provided by DRA in the simplified nomination form (required field).
- **Response deadline:** Flexible — assignor sets a deadline date; late submissions accepted with a flag.
- **Users:** 7 DRAs submitting nominations, ~50-100 referees responding, 1 assignor managing the process.
- **Tournament dates:** Weekend 1: May 16-17, 2026. Weekend 2: May 23-24, 2026.

## Constraints

- **Hosting:** GitHub Pages — static files only, no server-side rendering or API routes
- **Backend:** Google Apps Script — all server logic and sheet manipulation
- **Design:** Must match existing form's visual style (Open Sans, navy/red/gold color scheme)
- **Simplicity:** Single-page HTML files with inline CSS/JS, no build tools or frameworks

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Pivot from DRA-provides-all to referee-provides-own-details | Less work for DRAs, more accurate data from referees, eliminates redundant confirmation step | Decided 2026-03-19 |
| Token-in-URL for referee identity | Simplest approach, no login needed, prevents uninvited submissions | Decided |
| Mailto links for email (not MailApp) | Assignor uses Microsoft 365/Outlook | Decided |
| Spreadsheet columns for status tracking | Assignor already works in the sheet, no need for separate dashboard | Decided |
| Manual email trigger | Assignor wants control over when emails go out | Decided |
| Late submissions allowed with flag | Referee sees a notice; assignor sees the late flag in the sheet | Decided 2026-03-19 |
| Reuse existing token for re-nominated referees | Same referee always has the same link — less confusion | Decided 2026-03-19 |
| Referee can edit until deadline, then locked | Edits allowed before deadline; read-only after | Decided 2026-03-19 |

---
*Last updated: 2026-03-19 — pivoted to v2.0 (referee-provides-details workflow)*
