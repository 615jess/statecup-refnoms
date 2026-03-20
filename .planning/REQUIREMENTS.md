# Requirements: State Cup Referee Nomination & Detail Collection

**Defined:** 2026-03-19
**Core Value:** DRAs nominate referees with minimal effort (name + email + max ages + notes), and referees provide their own details directly — giving the assignor accurate, first-hand data to make game assignments.

## v2.0 Requirements

Requirements for the referee nomination & detail collection system. Supersedes v1.0.

### Nomination (DRA Form)

- [x] **NOM-01**: New DRA nomination form collects per referee: first name, last name, email, max age as AR, max age as referee, and DRA notes
- [x] **NOM-02**: DRA form supports spreadsheet upload for bulk nominations (download template + file upload)
- [x] **NOM-03**: DRA form writes one row per referee to Google Sheet with DRA metadata (timestamp, DRA name, email, district)
- [x] **NOM-04**: Token generated at nomination time (UUID stored in sheet per referee row)
- [x] **NOM-05**: If referee email already exists in sheet, reuse existing token and update DRA-provided fields (no duplicate rows)

### Referee Detail Form

- [ ] **DETAIL-01**: Static HTML referee detail form hosted on GitHub Pages, secured by token in URL
- [ ] **DETAIL-02**: Form reads token from URL and fetches referee data via GET request to Apps Script
- [ ] **DETAIL-03**: Form collects: weekend 1 availability, weekend 2 availability, hotel need per confirmed weekend, age, gender, phone, day-specific limitations, and notes for assignor
- [ ] **DETAIL-04**: Form shows tournament context: dates, assignor contact info, DRA name
- [ ] **DETAIL-05**: Re-visiting the link pre-fills with previously submitted data (supports edits until deadline)
- [ ] **DETAIL-06**: After deadline, form displays in read-only mode showing previously submitted data
- [ ] **DETAIL-07**: Late submissions (after deadline but before hard close) are accepted with a late flag; referee sees a notice
- [ ] **DETAIL-08**: After hard close, form shows a friendly "responses are closed" message with assignor contact
- [ ] **DETAIL-09**: Submit button disabled during POST to prevent double-submission
- [ ] **DETAIL-10**: Success screen displays summary of what was submitted (weekends, hotel, notes)
- [ ] **DETAIL-11**: Error state (invalid token, server error) shows assignor contact email and retry option

### Apps Script Backend

- [ ] **API-01**: doGet with valid token returns referee data as JSON (name, DRA, weekends, hotel, status, tournament context, deadline)
- [ ] **API-02**: doGet with invalid or missing token returns a JSON error response (not a 500 or HTML error page)
- [ ] **API-03**: doPost with action=nominateV2 creates referee rows from DRA form submission (with token, DRA data, "Not Sent" status)
- [ ] **API-04**: doPost with action=submitDetails writes referee-provided data to the existing row (never appends a new row)
- [ ] **API-05**: LockService guard on concurrent writes to prevent race conditions
- [ ] **API-06**: Deadline enforcement: late submissions accepted with flag; hard-close submissions rejected with JSON error
- [ ] **API-07**: doGet with action=getAllNominees returns all referee rows for the admin page
- [ ] **API-08**: Tournament constants (dates, assignor email, form URL) stored in PropertiesService

### Email Admin Page

- [ ] **ADMIN-01**: Static HTML admin page hosted on GitHub Pages
- [ ] **ADMIN-02**: Admin page fetches all nominees via doGet (action=getAllNominees) and displays name, email, DRA, and status
- [ ] **ADMIN-03**: Mailto link per referee opens Outlook with pre-filled To, Subject (personalized), and Body (referee name, tournament details, token-secured form link, assignor contact)
- [ ] **ADMIN-04**: Clicking a mailto link auto-marks the referee's status as "Sent" in the sheet via API call
- [ ] **ADMIN-05**: Admin page supports filtering/sorting by status (Not Sent / Sent / Confirmed)

### Sheet Schema

- [x] **SCHEMA-01**: Column structure supports DRA-submitted fields, system fields (token, status, timestamps), and referee-submitted fields
- [x] **SCHEMA-02**: Status column uses values: Not Sent / Sent / Confirmed
- [x] **SCHEMA-03**: Late flag column indicates post-deadline submissions
- [x] **SCHEMA-04**: Response deadline stored in sheet (named range at Z1 or equivalent)
- [x] **SCHEMA-05**: Existing nomination form (v1.0) continues to write correctly if used (backwards compatible) — DROPPED: v2.0 is clean-slate, no v1.0 backward compat needed

### User Experience

- [ ] **UX-01**: Referee detail form is mobile-responsive (16px min font, 44px touch targets, single-column under 560px)
- [ ] **UX-02**: All pages match existing visual style (Open Sans, navy/red/gold color scheme)
- [ ] **UX-03**: Admin page provides at-a-glance status overview of all nominees

## Future Requirements

Deferred to later milestones.

### Assignor Tools

- **FUTURE-01**: Re-send capability targeting only Not Sent referees
- **FUTURE-02**: Sheet summary formula showing Not Sent / Sent / Confirmed counts
- **FUTURE-03**: Batch "mark all as sent" for assignor who sent emails outside the admin page

### Automation

- **FUTURE-04**: Automated reminder emails for non-responders
- **FUTURE-05**: Microsoft Graph API integration for creating Outlook drafts directly

## Out of Scope

| Feature | Reason |
|---------|--------|
| MailApp/GmailApp auto-sending | Assignor uses Outlook (Microsoft 365), not Gmail |
| Login / authentication | Token-in-URL sufficient; low-sensitivity data |
| Separate tracking dashboard | Sheet is the dashboard |
| Full withdrawal flow | Referee can decline weekends; full withdrawal is a DRA conversation |
| Automated reminder emails | Manual re-send is sufficient at ~50-100 referees |
| SMS / push notifications | Email-only workflow |
| In-email one-click response | Email client prefetch breaks GET-with-side-effects; referees need to fill out the form |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHEMA-01 | Phase 1 | Complete |
| SCHEMA-02 | Phase 1 | Complete |
| SCHEMA-03 | Phase 1 | Complete |
| SCHEMA-04 | Phase 1 | Complete |
| SCHEMA-05 | Phase 1 | Complete (dropped — v2.0 clean-slate) |
| NOM-01 | Phase 2 | Complete |
| NOM-02 | Phase 2 | Complete |
| NOM-03 | Phase 2 | Complete |
| NOM-04 | Phase 2 | Complete |
| NOM-05 | Phase 2 | Complete |
| API-03 | Phase 2 | Complete |
| API-05 | Phase 2 | Complete |
| API-08 | Phase 2 | Complete |
| UX-02 | Phase 2 | Complete |
| DETAIL-01 | Phase 3 | Pending |
| DETAIL-02 | Phase 3 | Pending |
| DETAIL-03 | Phase 3 | Pending |
| DETAIL-04 | Phase 3 | Pending |
| DETAIL-05 | Phase 3 | Pending |
| DETAIL-06 | Phase 3 | Pending |
| DETAIL-07 | Phase 3 | Pending |
| DETAIL-08 | Phase 3 | Pending |
| DETAIL-09 | Phase 3 | Pending |
| DETAIL-10 | Phase 3 | Pending |
| DETAIL-11 | Phase 3 | Pending |
| API-01 | Phase 3 | Pending |
| API-02 | Phase 3 | Pending |
| API-04 | Phase 3 | Pending |
| API-06 | Phase 3 | Pending |
| UX-01 | Phase 3 | Pending |
| ADMIN-01 | Phase 4 | Pending |
| ADMIN-02 | Phase 4 | Pending |
| ADMIN-03 | Phase 4 | Pending |
| ADMIN-04 | Phase 4 | Pending |
| ADMIN-05 | Phase 4 | Pending |
| API-07 | Phase 4 | Pending |
| UX-03 | Phase 4 | Pending |

**Coverage:**
- v2.0 requirements: 38 total
- Mapped to phases: 38
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 — Phase 2 complete; NOM-01 through NOM-05, API-03, API-05, API-08, UX-02 marked Complete*
