# Roadmap: State Cup Referee Nominations

## Milestones

- ✅ **v2.0 Referee Nomination & Detail Collection** - Phases 1-5.1 (shipped 2026-03-23)
- 🚧 **v2.1 Communication & DRA Visibility** - Phases 6-7 (in progress)

## Phases

<details>
<summary>✅ v2.0 Referee Nomination & Detail Collection (Phases 1-5.1) - SHIPPED 2026-03-23</summary>

See `.planning/milestones/v2.0-ROADMAP.md` for full phase details.

### Phase 1: Schema Setup
**Goal**: The Google Sheet has the correct v2.0 column structure with valid status values, a late-flag column, and a confirmed column mapping document
**Plans**: 1 plan — all complete

### Phase 2: DRA Form + nominateV2
**Goal**: A DRA can submit referee nominations and each nomination creates exactly one sheet row with a token, leaving referee-detail columns blank
**Plans**: 2 plans — all complete

### Phase 3: Referee Detail Form + Backend
**Goal**: A referee who opens their token link can fill out availability and contact details, submit, and return to edit until the deadline
**Plans**: 3 plans — all complete

### Phase 4: Email Admin Page + getAllNominees
**Goal**: The assignor can open the admin page, see every nominee's status, and click a mailto link to open Outlook with a pre-written personalized email
**Plans**: 2 plans — all complete

### Phase 5: Pre-Go-Live Cleanup
**Goal**: All tech debt from the v2.0 audit is resolved and the system is ready for production use
**Plans**: 1 plan — all complete

### Phase 5.1: Parent/Guardian Email for Minors (INSERTED)
**Goal**: When a referee enters an age under 18, a required parent/guardian email field appears and is stored in column AB
**Plans**: 2 plans — all complete

</details>

---

### 🚧 v2.1 Communication & DRA Visibility (In Progress)

**Milestone Goal:** The assignor can efficiently re-reach non-responsive referees via filtered views and a BCC reminder, and DRAs can self-serve to see the status and details of their own nominees.

#### Phase 6: Admin Email Enhancements ✅

**Goal**: The assignor can filter the nominee table to see only uncontacted referees, and send a single BCC reminder email to all referees who have been emailed but haven't responded yet
**Depends on**: Phase 5.1 (modifies existing admin.html)
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03
**Success Criteria** (what must be TRUE):
  1. Assignor can filter the nominee table to show only "Not Sent" referees, making it easy to identify and re-send initial emails without scrolling through the full list
  2. Assignor sees a single BCC mailto link that opens Outlook addressed to all "Sent"-status referees at once
  3. The BCC reminder email opens with a pre-filled subject and generic body — no token links, no per-recipient personalization required
**Plans**: 2 plans — all complete

Plans:
- [x] 06-01-PLAN.md — Add "Not Sent" filter toggle to admin.html nominee table
- [x] 06-02-PLAN.md — Add BCC reminder mailto link for Sent-status referees

#### Phase 7: DRA Nominee View

**Goal**: A DRA can visit a dedicated page, select their name, and see a read-only table of all their nominees with full response details — and the nomination form links them there
**Depends on**: Phase 6 (shares backend pattern; DRA-05 links from nomination form)
**Requirements**: DRA-01, DRA-02, DRA-03, DRA-04, DRA-05
**Success Criteria** (what must be TRUE):
  1. DRA can navigate to the nominee view page, select their name from a dropdown, and see a table of only their nominees
  2. Each row in the table shows referee name, response status, and all referee-submitted details: availability, hotel, age, gender, phone, and notes
  3. The DRA cannot edit any data, submit nominations, or modify any row — the page is view-only
  4. The nomination form includes a visible link to the DRA nominee view page
**Plans**: TBD

Plans:
- [ ] 07-01: Build getDRANominees backend endpoint in adminemail.gs (filter by column B, return all detail columns)
- [ ] 07-02: Build dra-nominees.html page (DRA name dropdown, read-only table with all detail columns)
- [ ] 07-03: Add "Review previous nominations" link to spring-state-cup-nomination.html

---

## Progress

**Execution Order:**
Phases execute in numeric order: 6 → 7

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Schema Setup | v2.0 | 1/1 | Complete | 2026-03-19 |
| 2. DRA Form + nominateV2 | v2.0 | 2/2 | Complete | 2026-03-19 |
| 3. Referee Detail Form + Backend | v2.0 | 3/3 | Complete | 2026-03-20 |
| 4. Email Admin Page | v2.0 | 2/2 | Complete | 2026-03-21 |
| 5. Pre-Go-Live Cleanup | v2.0 | 1/1 | Complete | 2026-03-22 |
| 5.1. Parent/Guardian Email (INSERTED) | v2.0 | 2/2 | Complete | 2026-03-23 |
| 6. Admin Email Enhancements | v2.1 | 2/2 | Complete | 2026-03-30 |
| 7. DRA Nominee View | v2.1 | 0/3 | Not started | - |
