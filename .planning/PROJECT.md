# State Cup Referee Nominations

## What This Is

A web-based system for the Tennessee State Cup referee assignment workflow. District Referee Administrators (DRAs) nominate referees for the Spring State Cup tournament via an HTML form that writes to a Google Sheet. Nominated referees then receive an email with a unique confirmation link where they can confirm/edit their availability, hotel needs, and add notes for the assignor. The SRA, SYRA, and State Cup Assignor use the Google Sheet as the source of truth for game assignments.

## Core Value

DRAs can nominate referees and those referees can confirm their own availability — giving the assignor accurate, up-to-date data to make game assignments.

## Requirements

### Validated

- ✓ DRA nomination form with spreadsheet upload support — existing
- ✓ Form writes referee nominations to Google Sheet — existing
- ✓ Weekend availability selection (Weekend 1: May 16-17, Weekend 2: May 23-24) — existing
- ✓ Hotel accommodation tracking per weekend — existing
- ✓ Day-specific limitations and DRA notes — existing
- ✓ XSS protection, SRI, honeypot, file size limits — existing
- ✓ Server-side validation in Apps Script — existing

### Active

- [ ] Referee confirmation emails triggered manually by assignor
- [ ] Unique token-based confirmation links (no login required)
- [ ] Pre-filled confirmation form showing nominee's current data (name, weekends, hotel)
- [ ] Referee can confirm/decline each nominated weekend
- [ ] Referee can update hotel needs
- [ ] Referee can add free-text notes to the assignor
- [ ] Confirmation status tracked in Google Sheet (Confirmed/Pending/Declined)
- [ ] Referee edits write back to the Google Sheet
- [ ] Assignor can manually close confirmations when ready

### Out of Scope

- Full decline/opt-out (referee can decline individual weekends but the form isn't for withdrawing entirely — that's a conversation with the DRA)
- Login/authentication system — token-in-URL approach is sufficient; security isn't a major concern for this use case
- Automated confirmation emails on nomination submit — assignor triggers emails manually
- Dashboard for tracking confirmations — spreadsheet column is sufficient
- Game assignment tool — this system handles nominations and confirmations only

## Context

- **Hosting:** GitHub Pages (static site). No server-side backend except Google Apps Script.
- **Data store:** Google Sheets via Apps Script web app endpoints.
- **Architecture constraint:** All server-side logic must live in Google Apps Script. The HTML/JS is purely client-side.
- **Email:** Apps Script's MailApp or GmailApp service sends confirmation emails.
- **Token approach:** Apps Script generates a unique token per referee row, stored in the sheet. Confirmation link includes token as URL param. Confirmation page fetches referee data via GET request with token.
- **Referee emails:** Usually provided by DRA in the nomination form. If missing, assignor manually adds them to the sheet before triggering emails.
- **Confirmation deadline:** Flexible — assignor closes confirmations manually when ready to start assigning.
- **Users:** 7 DRAs submitting nominations, ~50-100 referees confirming, 1 assignor managing the process.
- **Tournament dates:** Weekend 1: May 16-17, 2026. Weekend 2: May 23-24, 2026.

## Constraints

- **Hosting:** GitHub Pages — static files only, no server-side rendering or API routes
- **Backend:** Google Apps Script — all server logic, email sending, and sheet manipulation
- **Design:** Must match existing form's visual style (Open Sans, navy/red/gold color scheme)
- **Simplicity:** Single-page HTML files with inline CSS/JS, no build tools or frameworks

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Token-in-URL for confirmation identity | Simplest approach, no login needed, security not a major concern | — Pending |
| Google Apps Script for email sending | Already the backend, has MailApp built in, no external service needed | — Pending |
| Spreadsheet column for confirmation tracking | Assignor already works in the sheet, no need for separate dashboard | — Pending |
| Manual email trigger | Assignor wants control over when emails go out | — Pending |

---
*Last updated: 2026-03-17 after initialization*
