# Requirements: State Cup Referee Nominations

**Defined:** 2026-03-30
**Core Value:** DRAs nominate referees with minimal effort (name + email only), and referees provide their own details directly — giving the assignor accurate, first-hand data to make game assignments.

## v2.1 Requirements

Requirements for milestone v2.1: Communication & DRA Visibility.

### Admin Email Enhancements

- [x] **ADMIN-01**: Admin page provides a filter to show only "Not Sent" referees for re-sending initial emails
- [x] **ADMIN-02**: Admin page provides a single BCC mailto link to send a generic reminder to all referees with Status = "Sent" (emailed but haven't responded)
- [x] **ADMIN-03**: Reminder mailto pre-fills subject and body with a generic follow-up message (no personalized token links)

### DRA Nominee View

- [ ] **DRA-01**: New page where DRA selects their name from a dropdown to view their nominees
- [ ] **DRA-02**: DRA nominee table displays referee name, response status, and all referee-submitted details (availability, hotel, age, gender, phone, notes)
- [ ] **DRA-03**: DRA view is read-only — no edit or nomination capability
- [ ] **DRA-04**: Backend endpoint returns nominees filtered by DRA name (column B)
- [ ] **DRA-05**: DRA nomination form includes a "Review previous nominations" link to the DRA nominee view page

## Future Requirements

Deferred to later milestones. Tracked but not in current roadmap.

### Operational Enhancements

- **OPS-01**: Sheet summary formula showing Not Sent / Sent / Confirmed counts
- **OPS-02**: Batch "mark all as sent" for emails sent outside admin page
- **OPS-03**: Microsoft Graph API integration for creating Outlook drafts directly

## Out of Scope

| Feature | Reason |
|---------|--------|
| Automated email sending | Assignor wants manual control over when emails go out |
| DRA editing/deleting nominees from view page | View is read-only; changes go through nomination form |
| Assignment notifications to referees | Game assignment is outside this system's scope |
| Login/authentication for DRA view | Name-selection dropdown is sufficient for 7 known DRAs |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ADMIN-01 | Phase 6 | Complete |
| ADMIN-02 | Phase 6 | Complete |
| ADMIN-03 | Phase 6 | Complete |
| DRA-01 | Phase 7 | Pending |
| DRA-02 | Phase 7 | Pending |
| DRA-03 | Phase 7 | Pending |
| DRA-04 | Phase 7 | Pending |
| DRA-05 | Phase 7 | Pending |

**Coverage:**
- v2.1 requirements: 8 total
- Mapped to phases: 8
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-30*
*Last updated: 2026-03-30 after roadmap creation*
