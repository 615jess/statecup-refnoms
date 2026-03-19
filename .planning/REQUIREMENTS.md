# Requirements: State Cup Referee Confirmation System

**Defined:** 2026-03-18
**Core Value:** DRAs can nominate referees and those referees can confirm their own availability — giving the assignor accurate, up-to-date data to make game assignments.

## v1.0 Requirements

Requirements for the referee confirmation system. Each maps to roadmap phases.

### Token & Identity

- [ ] **TOKEN-01**: Apps Script generates a unique UUID token per referee row and stores it in the sheet
- [ ] **TOKEN-02**: Token is generated when assignor accesses the admin email page
- [ ] **TOKEN-03**: Confirmation URL includes token as a query parameter (confirm.html?token=...)

### Email Delivery

- [ ] **EMAIL-01**: Admin page lists all nominated referees with mailto: links
- [ ] **EMAIL-02**: Mailto link opens Outlook with pre-filled To (referee email), Subject (personalized with referee name + tournament), and Body (confirmation link + tournament details)
- [ ] **EMAIL-03**: Email body includes referee's name, nominated weekends, confirmation link, and assignor contact info
- [ ] **EMAIL-04**: Confirmation status updates to "Pending" when tokens are generated

### Confirmation Form

- [ ] **FORM-01**: Static HTML confirmation page (confirm.html) hosted on GitHub Pages
- [ ] **FORM-02**: Page reads token from URL and fetches referee data via GET request to Apps Script
- [ ] **FORM-03**: Form pre-fills with referee's current nomination data (name, weekends, hotel)
- [ ] **FORM-04**: Referee can confirm or decline each nominated weekend independently
- [ ] **FORM-05**: Referee can update hotel needs per confirmed weekend (conditional — only shown when weekend is confirmed)
- [ ] **FORM-06**: Referee can add free-text notes to the assignor
- [ ] **FORM-07**: Submit button disabled during POST to prevent double-submission
- [ ] **FORM-08**: Re-visiting the confirmation link loads current data (supports re-submission/updates)

### Sheet Integration

- [ ] **SHEET-01**: Apps Script doGet endpoint returns referee row data by token lookup
- [ ] **SHEET-02**: Apps Script doPost endpoint updates the referee's existing row (not append) by token
- [ ] **SHEET-03**: Confirmation status column tracks Not Sent / Pending / Confirmed / Declined per referee
- [ ] **SHEET-04**: Confirmation timestamp recorded when referee submits
- [ ] **SHEET-05**: New columns appended to right side of existing sheet (never insert — preserves nomination data)

### User Experience

- [ ] **UX-01**: Confirmation page is mobile-responsive (16px min font, 44px touch targets, single-column under 560px)
- [ ] **UX-02**: Success screen displays summary of what the referee confirmed (weekends, hotel, notes)
- [ ] **UX-03**: Error state shows retry option and assignor contact email
- [ ] **UX-04**: Page matches existing form's visual style (Open Sans, navy/red/gold color scheme)

## Future Requirements

Deferred to later milestones.

### Assignor Tools

- **ADMIN-01**: Re-send capability targeting only Pending/Not Sent referees
- **ADMIN-02**: Close confirmations with friendly message for late clickers
- **ADMIN-03**: Sheet summary formula showing Confirmed/Pending/Declined counts

### Automation

- **AUTO-01**: Automated reminder emails for non-responders
- **AUTO-02**: Microsoft Graph API integration for creating Outlook drafts directly

## Out of Scope

| Feature | Reason |
|---------|--------|
| MailApp/GmailApp auto-sending | Assignor uses Outlook (Microsoft 365), not Gmail |
| Login / authentication | Token-in-URL sufficient; low-sensitivity data |
| Separate tracking dashboard | Sheet is the dashboard |
| Full withdrawal flow | Declining weekends is sufficient; full withdrawal is a DRA conversation |
| In-email one-click confirmation | Email client prefetch breaks it; referees need to review pre-filled data |
| Automated reminder emails | Manual re-send is sufficient at this scale |
| SMS / push notifications | Email-only workflow |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TOKEN-01 | Phase 2 | Pending |
| TOKEN-02 | Phase 2 | Pending |
| TOKEN-03 | Phase 2 | Pending |
| EMAIL-01 | Phase 4 | Pending |
| EMAIL-02 | Phase 4 | Pending |
| EMAIL-03 | Phase 4 | Pending |
| EMAIL-04 | Phase 4 | Pending |
| FORM-01 | Phase 3 | Pending |
| FORM-02 | Phase 3 | Pending |
| FORM-03 | Phase 3 | Pending |
| FORM-04 | Phase 3 | Pending |
| FORM-05 | Phase 3 | Pending |
| FORM-06 | Phase 3 | Pending |
| FORM-07 | Phase 3 | Pending |
| FORM-08 | Phase 3 | Pending |
| SHEET-01 | Phase 2 | Pending |
| SHEET-02 | Phase 2 | Pending |
| SHEET-03 | Phase 1 | Complete |
| SHEET-04 | Phase 1 | Complete |
| SHEET-05 | Phase 1 | Complete |
| UX-01 | Phase 3 | Pending |
| UX-02 | Phase 3 | Pending |
| UX-03 | Phase 3 | Pending |
| UX-04 | Phase 3 | Pending |

**Coverage:**
- v1.0 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 — Phase 1 complete (SHEET-03, SHEET-04, SHEET-05 verified)*
