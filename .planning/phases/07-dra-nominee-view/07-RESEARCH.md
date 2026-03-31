# Phase 7: DRA Nominee View — Research

**Researched:** 2026-03-30
**Phase:** 07-dra-nominee-view

## Phase Goal

A DRA can visit a dedicated page, select their name from a dropdown, and see a read-only table of all their nominees with full response details — and the nomination form links them there.

## Requirements

| ID | Requirement | Plan |
|----|------------|------|
| DRA-04 | Backend endpoint returns nominees filtered by DRA name (column B) | 07-01 |
| DRA-01 | New page where DRA selects their name from a dropdown to view their nominees | 07-02 |
| DRA-02 | DRA nominee table displays referee name, response status, and all referee-submitted details | 07-02 |
| DRA-03 | DRA view is read-only — no edit or nomination capability | 07-02 |
| DRA-05 | DRA nomination form includes a "Review previous nominations" link | 07-03 |

## Codebase Analysis

### Backend Architecture (Apps Script)

**Entry points:**
- `doGet(e)` in `refdetails.gs` (line 188) — routes GET requests by `action` parameter
- `doPost(e)` in `nominatev2.gs` — routes POST requests by `payload.action`

**Existing routing in doGet:**
```javascript
if (action === 'getAllNominees') {
  return _handleGetAllNominees();  // adminemail.gs
}
// else: token-based referee detail lookup
```

**Pattern for new endpoint:** Add `action=getDRANominees` route to `doGet` in `refdetails.gs`, calling `_handleGetDRANominees(draName)` defined in `adminemail.gs`. This follows the exact same pattern as `getAllNominees`.

**Shared scope:** All `.gs` files compile into a single GAS scope. Functions and constants declared in any file are callable from any other file. Column constants declared in `nominatev2.gs` (COL_DRA_NAME, COL_FIRST_NAME, etc.) and `refdetails.gs` (COL_PHONE, COL_AGE, etc.) are available in `adminemail.gs`.

### Column Map (relevant to DRA view)

Data the DRA view needs to return (0-based array indices from `getValues()`):

| Field | Column | 1-based | 0-based | Writer |
|-------|--------|---------|---------|--------|
| First Name | F | 6 | 5 | DRA form |
| Last Name | G | 7 | 6 | DRA form |
| Status | S | 19 | 18 | System |
| Phone | I | 9 | 8 | Referee form |
| Age | J | 10 | 9 | Referee form |
| Availability | M | 13 | 12 | Referee form |
| Gender | N | 14 | 13 | Referee form |
| Hotel Wkd 1 | O | 15 | 14 | Referee form |
| Hotel Wkd 2 | P | 16 | 15 | Referee form |
| RefWeekend1 | V | 22 | 21 | Referee form |
| RefWeekend2 | W | 23 | 22 | Referee form |
| RefNotes | Y | 25 | 24 | Referee form |

**NOT returned to DRA view:**
- Email (H) — DRA already knows it (per 07-CONTEXT.md decision)
- Token (R) — internal system field
- SentAt (T), SubmittedAt (U), LateFlag (X) — admin-only fields
- Parent/Guardian Email (AB) — admin-only field
- DRA Name (B), DRA Email (C), District (D) — the DRA already knows their own info

### Status Mapping

Sheet status values → DRA-facing labels (per 07-CONTEXT.md):
- `"Confirmed"` → **"Responded"** (referee has submitted details)
- `"Not Sent"` or `"Sent"` → **"Pending"** (referee has not yet submitted)

This simplification makes sense because DRAs don't need to know whether the assignor has emailed the referee yet — they just care whether the referee responded.

### DRA Name Dropdown

The DRA names come from column B of the sheet data. The backend can return distinct DRA names, or the frontend can derive them. Since the endpoint already filters by DRA name, returning distinct names as a separate field is cleaner.

**Approach:** The `_handleGetDRANominees` endpoint accepts a `draName` parameter. A separate `action=getDRANames` endpoint (or included in the same response when no `draName` is provided) returns the distinct DRA names for the dropdown.

**Simpler approach:** Single endpoint `getDRANominees`:
- If `draName` param is present: return filtered nominees
- If `draName` param is absent: return just the distinct DRA names list
- This avoids a second endpoint and keeps the API surface small

### Frontend Architecture

**Design system (from admin.html and nomination form):**
- CSS variables: --navy (#0d2148), --red (#cc2229), --gold (#c8912a), --white, --off (#f4f6f9), --slate (#e8edf5), --border (#d0d9e8), --muted (#5a6a88), --text (#1a2540), --green (#1a6b31), --r (6px)
- Font: Open Sans (300, 400, 600, 700)
- Layout: topbar gradient → site-header with hero → dates-row → main content → footer
- Max-width: 1100px (admin) or 860px (nomination form) — DRA view is read-only table so 1100px is appropriate
- Loading/error states: `.state-card` pattern with spinner, error display, retry button

**Page structure for dra-nominees.html:**
1. Standard topbar + header + dates-row (copy from admin.html)
2. Loading state → Error state → Content state (same pattern as admin.html)
3. DRA dropdown selector (styled like form fields from nomination form)
4. Summary count bar (e.g., "5 nominees — 3 responded, 2 pending")
5. Read-only table with expandable rows
6. Footer with logo

**Expandable rows approach:**
- Compact row: referee name + status badge
- Click to expand: shows detail panel below the row
- Expanded panel: labeled list of referee-submitted details
- Pending referees: expand shows "Waiting for response" message (no details to show)

### Local Storage

Browser remembers last DRA selection:
- Key: `draNomineeView_selectedDRA`
- On page load: read from localStorage, if found, auto-select and fetch
- On DRA selection: save to localStorage

### Link from Nomination Form

The nomination form (`spring-state-cup-nomination.html`) needs a "Review your nominees" link at the top, above the form fields. The link points to `dra-nominees.html` (relative URL — both files are in the same directory).

**Placement:** After the hero/header section, before the first form section. A simple styled link that fits the design system.

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| DRA name mismatch (case sensitivity) | Filter uses exact match on column B values; dropdown populated from same column |
| Large dataset performance | Sheet has ~100 nominees max; single getValues() call is fast |
| Apps Script deployment URL change | Documented in memory; SCRIPT_URL constant at top of HTML file |
| No authentication | Acceptable — dropdown of 7 known DRAs, no sensitive data exposed beyond what DRA already knows |

## Plan Breakdown

| Plan | Scope | Files Modified | Depends On |
|------|-------|---------------|-----------|
| 07-01 | Backend: `_handleGetDRANominees` + doGet routing | adminemail.gs, refdetails.gs | None |
| 07-02 | Frontend: dra-nominees.html (new file) | dra-nominees.html (new) | 07-01 |
| 07-03 | Link: "Review your nominees" on nomination form | spring-state-cup-nomination.html | 07-02 (needs to know the filename) |

---

*Phase: 07-dra-nominee-view*
*Research completed: 2026-03-30*
