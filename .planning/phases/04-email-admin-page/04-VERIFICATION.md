---
phase: 04-email-admin-page
verified: 2026-03-21T00:00:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
human_verification:
  - test: "Open admin.html in a browser with the deployed SCRIPT_URL and confirm the nominee table loads"
    expected: "All sheet nominees appear with Name, Email, DRA, Status, Wkd 1, Wkd 2 columns populated"
    why_human: "Cannot execute fetch() against a live Apps Script deployment from a static file check"
  - test: "Find a Not Sent referee and click their Send Email button"
    expected: "Outlook opens with To, Subject, and Body pre-filled; body includes referee name, DRA name, tournament dates, token-secured form URL, and assignor email; status badge changes to Sent"
    why_human: "mailto: URL behavior and Outlook integration cannot be verified programmatically"
  - test: "After clicking Send Email, check the Google Sheet column S for that referee"
    expected: "Column S shows 'Sent' and column T shows a timestamp — without any additional action by the assignor"
    why_human: "Requires live Apps Script deployment and sheet access"
  - test: "Verify backward compatibility: submit a test nomination via spring-state-cup-nomination.html, then load referee-details.html?token=VALID_TOKEN"
    expected: "Both Phase 2 (nominateV2) and Phase 3 (getDetails/submitDetails) routes still work correctly"
    why_human: "Requires live environment with real sheet data"
---

# Phase 4: Email Admin Page — Verification Report

**Phase Goal:** The assignor can open the admin page, see every nominee's name, email, DRA, and status at a glance, click a mailto link to open Outlook with a pre-written personalized email, and have the referee's status auto-updated to Sent after clicking.

**Verified:** 2026-03-21
**Status:** PASSED (automated structural checks) — human verification items noted below
**Re-verification:** No — initial verification


## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin page loads all nominees from the sheet and displays name, email, DRA name, and current status in a table | VERIFIED | `loadNominees()` fetches `?action=getAllNominees`; `renderTable()` populates tbody with 7 columns including name, email, DRA, status, wkd1, wkd2, action |
| 2 | Clicking a mailto link opens Outlook with To, Subject, and Body pre-filled — body includes referee name, DRA, tournament details, token-secured form link, and assignor contact | VERIFIED | `buildMailtoHref()` constructs full `mailto:` URL with `encodeURIComponent()` on subject and body; body template confirmed with all required fields |
| 3 | After clicking a mailto link, the referee's sheet status updates to Sent without additional action | VERIFIED | `handleEmailClick()` awaits `markSent` POST before `window.location.href = href`; `_handleMarkSent` writes COL_STATUS='Sent' and COL_SENT_AT=new Date() |
| 4 | The assignor can filter or sort the table by status to identify Not Sent referees at a glance | VERIFIED | Default `sortState = { col: 'status', dir: 'asc' }` puts Not Sent first; header clicks toggle sort; search input filters by name/email in real-time |

**Score:** 4/4 truths verified


## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/adminemail.gs` | `_handleGetAllNominees` and `_handleMarkSent`, COL_SENT_AT=20 | VERIFIED | 227 lines; both functions present; `var COL_SENT_AT = 20;` declared; no doGet/doPost; no redeclared shared constants |
| `scripts/refdetails.gs` | doGet routes `action=getAllNominees` before token path | VERIFIED | Line 187 checks `e.parameter.action` first; line 191 routes `getAllNominees` to `_handleGetAllNominees()`; line 196 falls through to token path |
| `scripts/nominatev2.gs` | doPost routes `action=markSent` to `_handleMarkSent` | VERIFIED | Line 125: `if (payload.action === 'markSent') { return _handleMarkSent(payload); }` — after nominateV2 and submitDetails, before unknown-action fallback |
| `admin.html` | Complete admin page: table, sort, filter, mailto, markSent | VERIFIED | 617 lines; all 7 required JS functions present; 7-column table; `overflow-x: auto`; no external JS libraries |


## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `admin.html loadNominees()` | `SCRIPT_URL?action=getAllNominees` | `fetch()` GET | WIRED | Line 292: `fetch(SCRIPT_URL + '?action=getAllNominees')` — response stored in `allNominees` and `tournamentProps` |
| `admin.html handleEmailClick()` | `SCRIPT_URL` POST `markSent` | `fetch()` POST with JSON body | WIRED | Lines 529-532: `fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'markSent', token }) })` — awaited before Outlook opens |
| `admin.html buildMailtoHref()` | `mailto:` URL | `encodeURIComponent` on subject and body | WIRED | Lines 512-514: full `mailto:` construction with all required fields from nominee + tournamentProps |
| `admin.html handleEmailClick()` | `admin.html updateRowStatus()` | in-place DOM update after markSent | WIRED | Line 536: `updateRowStatus(token, 'Sent')` called on `data.ok`; also called optimistically on error (lines 540, 545) |
| `refdetails.gs doGet` | `adminemail.gs _handleGetAllNominees` | `action === 'getAllNominees'` routing | WIRED | Lines 191-193 in refdetails.gs; function callable via GAS shared scope |
| `nominatev2.gs doPost` | `adminemail.gs _handleMarkSent` | `payload.action === 'markSent'` routing | WIRED | Line 125-127 in nominatev2.gs; function callable via GAS shared scope |
| `adminemail.gs _handleMarkSent` | `refdetails.gs _findRowByToken` | GAS shared scope function call | WIRED | Line 193: `_findRowByToken(sheet, token)` — uses Phase 3 helper without redeclaration |


## Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| ADMIN-01: Nominee table with name, email, DRA, status | SATISFIED | 7-column table; `renderTable()` populates all required fields from `allNominees` array |
| ADMIN-02: Sortable table | SATISFIED | `handleHeaderClick()` on all `th[data-sort-col]`; `sortNominees()` with custom status order |
| ADMIN-03: Filterable by status / search | SATISFIED | `searchQuery` filter in `renderTable()`; default sort shows Not Sent first |
| ADMIN-04: mailto link with pre-filled email | SATISFIED | `buildMailtoHref()` — To, Subject, Body with firstName, draName, weekend dates, form URL+token, assignorEmail, deadlineDisplay |
| ADMIN-05: Auto-update to Sent after mailto click | SATISFIED | `handleEmailClick()` awaits markSent POST before `window.location.href`; `updateRowStatus()` updates badge+button+summary in-place |
| API-07: markSent endpoint with idempotency | SATISFIED | `_handleMarkSent` reads current status, returns early if !== 'Not Sent'; LockService with 15s waitLock; finally block releases lock |
| UX-03: Summary counts bar | SATISFIED | `renderSummary()` renders Total, Not Sent, Sent, Confirmed counts; called on load and after each status change |


## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `scripts/nominatev2.gs` line 437 | `'REF_FORM_URL': 'TBD — set to GitHub Pages URL before Phase 4'` in `setTournamentConstants()` | INFO | Placeholder value in a one-time setup function — does not affect runtime if `setTournamentConstants` has already been run with the real URL. SUMMARY confirms user was instructed to update this before testing. |

No blockers or warnings. The `REF_FORM_URL` placeholder in `setTournamentConstants()` is expected — it is a one-time admin function, not a code path executed at runtime. The actual property value stored in PropertiesService is what the admin page reads.


## Human Verification Required

### 1. Admin Page Loads Nominees from Live Sheet

**Test:** Open `admin.html` in a browser (the SCRIPT_URL is already populated with the deployment URL `https://script.google.com/macros/s/AKfycbyMjgbP4I21oZ03smJR8SI-oeG3oiwx3tdk3QDDdoAsbve9lQDWotHmRbQzw4TFqhWy/exec`). Verify the nominee table loads with real data.

**Expected:** All nominees from the Google Sheet appear in the table. Summary counts (Total, Not Sent, Sent, Confirmed) are accurate.

**Why human:** Cannot execute fetch() against a live Apps Script deployment from static code inspection.

### 2. Mailto Click Opens Outlook and Updates Status

**Test:** Find a referee with "Not Sent" status and click their Send Email button.

**Expected:**
- Outlook opens with To field pre-filled (referee email), Subject pre-filled ("State Cup Referee Nomination — Action Required"), and Body containing referee first name, DRA name, weekend dates, the token-secured form link, and assignor contact email.
- The referee's row badge immediately changes to "Sent" and the button becomes disabled.
- Body length is under 1800 characters.

**Why human:** mailto: URL behavior and Outlook integration cannot be verified programmatically. The `buildMailtoHref()` function has been verified to include all required fields in the body, but rendered display in Outlook requires human confirmation.

### 3. Sheet Status Persists After Click

**Test:** After clicking Send Email for a referee, check the Google Sheet.

**Expected:** Column S (Status) shows "Sent" and column T (SentAt) shows a timestamp — with no additional action required from the assignor.

**Why human:** Requires live Apps Script deployment + sheet access. The `_handleMarkSent` function writes both cells and is correctly wired, but end-to-end persistence requires live confirmation.

### 4. Backward Compatibility

**Test:** Submit a test nomination via `spring-state-cup-nomination.html` and load `referee-details.html?token=VALID_TOKEN`.

**Expected:** Both Phase 2 (nominateV2) and Phase 3 (getDetails/submitDetails) routes work correctly. The Phase 4 routing additions in doGet and doPost use additive `if` branches and do not modify any existing branches.

**Why human:** Requires live environment. Code inspection confirms the existing nominateV2 and submitDetails branches are unchanged in doPost, and the existing token-based path is unchanged in doGet.


## Gaps Summary

No gaps. All automated structural checks passed:

- `scripts/adminemail.gs`: Both handler functions implemented with correct column indices (cross-verified against COLUMN-MAP.md), LockService pattern, idempotency check, and tournament props in getAllNominees response.
- `scripts/refdetails.gs`: doGet routes `action=getAllNominees` at line 191, before the token-based path at line 196 — correct ordering preserved.
- `scripts/nominatev2.gs`: doPost routes `markSent` at line 125 with correct ordering (nominateV2 → submitDetails → markSent → unknown-action fallback).
- `admin.html`: 617 lines; all 7 required JS functions defined and wired; 7-column sortable/filterable table; correct badge colors; SCRIPT_URL contains a real deployment URL (not the placeholder); no external JS dependencies; `overflow-x: auto` for responsive table; handleEmailClick awaits markSent POST before window.location.href.
- Phase 2/3 backward compatibility: existing doGet and doPost branches are structurally intact and unchanged.

The SUMMARY's claim that "plan executed exactly as written" is confirmed against actual code.

---

*Verified: 2026-03-21*
*Verifier: Claude (gsd-verifier)*
