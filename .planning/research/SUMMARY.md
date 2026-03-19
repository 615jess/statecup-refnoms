# Project Research Summary

**Project:** State Cup Referee Nominations — v2.0 Milestone
**Domain:** Token-secured self-service detail collection (subsequent milestone on existing Apps Script + Sheets + GitHub Pages system)
**Researched:** 2026-03-19
**Confidence:** HIGH
**Replaces:** v1.0 SUMMARY.md (2026-03-17) — that document remains in git history; this document covers v2.0 only

---

## Executive Summary

v2.0 is a focused pivot, not a rebuild. The existing stack (Apps Script, Google Sheets, GitHub Pages static HTML) is validated and stays. What changes is the workflow: DRAs stop providing 14 fields per referee and instead provide only name + email. The referee then provides all remaining details — age, gender, phone, availability, hotel needs, day-specific notes — via a token-secured form linked from a manually-sent Outlook email. All four research areas converge on the same conclusion: the existing column schema accommodates v2.0 without adding columns (referee writes to I–P which DRA used to own), and the architecture needs three new components (simplified DRA form, referee detail form, email admin page) plus two new Apps Script endpoint categories (doGet and an expanded doPost router).

The assignment of column-writer responsibility is the single most important decision before any code is written. Columns I–P currently have DRA-provided data written at nomination time; in v2.0, they will be blank at nomination time and filled by the referee later. Every downstream system — the Apps Script backend, the sheet schema validation, the assignor's column expectations — depends on this being correctly handled. The research is unambiguous: referee writes to existing I–P columns (Option A), token is generated at nomination time in doPost, and status vocabulary updates from Confirmed/Declined to Submitted/Pending/Not Sent. These three decisions must be locked in Phase 1 before any code is written.

The primary risks are operational, not architectural. The biggest hazard is writing a referee detail submission using `appendRow` instead of `findRowByToken` + `setValues`, which creates silent duplicate rows. The second hazard is the v1.0 column S data validation dropdown rejecting v2.0 status values — this produces a silent cell-level warning the assignor won't notice until they see orange triangles in the sheet. Both are straightforward to prevent with explicit test assertions. The mailto 2000-character limit and timezone boundary on deadline checking are secondary risks requiring care but not additional research.

---

## Key Findings

### Recommended Stack

The v1.0 stack is fully retained. No new libraries, frameworks, or services are introduced. The only explicit removals are SheetJS (xlsx-0.20.3) from the DRA form — it solved bulk entry of 14 fields, but is unnecessary overhead for a 2-field form — and MailApp/GmailApp, which was never correct for an Outlook-based assignor.

New capabilities added within the existing stack:

- **PropertiesService** — stores tournament constants (assignor email, weekend dates, confirm page URL) outside the sheet; read by doGet on every referee form load
- **doGet endpoint** — not implemented in v1.0; v2.0 requires it to return referee identity, prior submission data, deadline state, and tournament context in one response
- **Two-tier deadline enforcement** — server-side check in doPost is authoritative; client-side disables inputs for UX only; the `disabled` attribute (not `readonly`) is correct for full lockdown

**Core technologies:**
- `Utilities.getUuid()`: token generation — generated at nomination time in doPost, stored in column R as element 17 (0-based) of the `appendRow` array
- `PropertiesService.getScriptProperties()`: tournament constants — ASSIGNOR_EMAIL, TOURNAMENT_YEAR, WEEKEND_1_DATES, WEEKEND_2_DATES, CONFIRM_PAGE_URL
- `LockService.getScriptLock()`: concurrent write guard on submitDetails doPost — unchanged pattern from v1.0
- `ss.getRangeByName('ConfirmationDeadline')`: deadline read — unchanged from v1.0 Phase 1 setup
- `mailto:` links with `encodeURIComponent()`: email sending — stay under 1800 characters to reliably open Outlook on Windows (2000-char hard limit; 1800 is the safe threshold)

**What NOT to add:**

| Do Not Add | Use Instead |
|------------|-------------|
| SheetJS (xlsx) | Remove entirely — 2-field form makes upload overhead unjustifiable |
| MailApp / GmailApp | mailto links in admin page — assignor is on Microsoft 365/Outlook |
| SpreadsheetApp.getUi().createMenu() | Admin HTML page with mailto links |
| JWT or session tokens | Utilities.getUuid() token-in-URL |
| External storage | Existing Google Sheet handles 50–100 rows trivially |

See STACK.md for full detail and all version references.

### Expected Features

**Must have — P1 (system does not work without these):**
- Simplified DRA form: name + email per referee only; no other referee fields; SheetJS removed
- Token-secured referee detail form: availability (W1/W2), hotel per weekend (conditional), age, gender, phone, day-specific limitations, notes
- doGet returns referee name, any prior submission data for pre-fill, deadline state, tournament context
- doPost submitDetails writes referee fields to columns I–P + V–Y; sets Status to Submitted; sets LateFlag (col X) if past deadline
- Admin page: all nominees in a table with pre-composed mailto links for Outlook
- Status lifecycle: Not Sent / Pending / Submitted — replaces v1.0 Confirmed/Declined vocabulary
- Referee can re-open link and re-submit until deadline (upsert, not guard against re-submission)
- Late submissions: accepted with LateFlag = "Y" in column X; referee sees inline notice
- Success screen summarizing what was submitted; error state with assignor contact

**Should have — P2 (reduces support burden significantly):**
- "Past deadline" inline notice banner rendered when doGet response indicates deadline passed
- Closed-form hard-stop state (distinct from late-but-still-accepting)
- Edit pre-fill for returning visitors (shows their own prior submission data)
- Visual de-emphasis of Submitted rows on admin page

**Nice to have — P3:**
- COUNTIF summary formula area in sheet header
- Admin page visual de-emphasis for already-submitted rows

**Explicitly out of scope — do not build:**
- Automated email sending on nomination submit
- Automated reminder emails
- Separate tracking dashboard outside the sheet
- Full referee withdrawal self-service
- In-email one-click submission
- Login or OAuth
- Persistent referee profile across tournament years

See FEATURES.md for the full prioritization matrix and anti-features list.

### Architecture Approach

Three GitHub Pages static HTML files call a single Apps Script `/exec` endpoint using action-based routing in doGet and doPost. All state lives in the existing Google Sheet. No new columns are needed: referee detail data writes to existing columns I–P (writer changes from DRA form to referee detail form; column positions do not change), and column X is repurposed from RefHotel to LateFlag.

**System diagram (abbreviated):**

```
spring-state-cup-nomination.html  →  POST action=nominateV2  →  doPost: append row A-H+Q+R(token); I-P blank
email-admin.html                  →  GET  action=getAllNominees  →  doGet: return all rows as JSON
referee-details.html              →  GET  action=getDetails   →  doGet: return referee data + context
                                  →  POST action=submitDetails →  doPost: write I-P, V-W, U, X, Y; S=Submitted
                                                                     ↓
                                                              Google Sheet
                                                              A-H, Q: DRA-provided
                                                              I-P: referee-provided (blank at nomination)
                                                              R: Token
                                                              S: Status
                                                              U: SubmittedAt
                                                              V-W: RefWeekend1/2
                                                              X: LateFlag
                                                              Y: RefNotes
                                                              Z1: ConfirmationDeadline (named range)
```

**Major components:**

1. **Simplified DRA nomination form** — DRA submits name + email per referee; nominateV2 appends row with A-H and Q filled, I-P blank, token in R
2. **Referee detail form** (`referee-details.html`) — token-secured; six UI states: loading, form normal, form with late-notice banner, read-only (post-deadline + already submitted), error, success
3. **Email admin page** (`email-admin.html`) — assignor-facing; loads all nominees via getAllNominees; renders status table with pre-composed mailto links; no write capability
4. **Apps Script doGet** (new) — routes `getDetails` and `getAllNominees`
5. **Apps Script doPost nominateV2** (new branch) — email deduplication, token generated at nomination time, append or update row
6. **Apps Script doPost submitDetails** (new branch) — token lookup, deadline check, field writes, status transition

**Key patterns to follow:**
- Action-based routing: dispatcher is thin; each action delegates to a named handler function
- Batch read: `getDataRange().getValues()` once per request; never `.getValue()` per row in a loop
- Token reuse: `findRowByEmail()` before generating — if row exists, preserve existing token in col R
- Deadline check: `ss.getRangeByName('ConfirmationDeadline').getValue()` — compare date-only (not raw Date objects) to avoid timezone false positives

**Build order is determined by dependencies (cannot be reordered):**
1. Schema update → 2. DRA form + nominateV2 → 3. getDetails + submitDetails → 4. getAllNominees → 5. referee-details.html → 6. email-admin.html

See ARCHITECTURE.md for complete data flow diagrams and all pattern implementations.

### Critical Pitfalls

1. **Status dropdown rejects v2.0 values before any backend code runs** — Phase 1 locked column S to Not Sent / Pending / Confirmed / Declined. Writing "Submitted" triggers a silent cell-level warning, not an Apps Script exception — the write succeeds but the cell shows an orange triangle the assignor may not notice for days. Update the data validation rule to v2.0 values before any backend code is written. (PITFALLS.md Pitfall 8)

2. **Referee detail submission uses appendRow instead of row update** — the codebase pattern throughout v1.0 is `appendRow`; the submitDetails handler must never call it. Always `findRowByToken()` + `sheet.getRange(row, col).setValue()`. Verify by asserting `sheet.getLastRow()` stays constant before and after a detail submission. Silent failure: duplicate orphaned rows. (PITFALLS.md Pitfall 3)

3. **Re-nomination via simplified DRA form overwrites referee-submitted I–P data** — the new DRA form must not include I–P fields at all, not submit them as empty strings. An empty-string write from a re-nomination silently overwrites the referee's previously-submitted phone, age, and availability. nominateV2 must write only A-H and Q. (PITFALLS.md Pitfall 1 + ARCHITECTURE.md Anti-Pattern 1)

4. **Token missing from appendRow array at nomination time** — if token generation is deferred (old v1.0 approach), admin page mailto links will contain `?token=` with no value. The token must be element 17 (0-based) of the appendRow call: array is 18 elements for columns A through R. (PITFALLS.md Pitfall 5)

5. **Deadline timezone mismatch flags on-time referees as late** — Apps Script `new Date()` is UTC; the assignor thinks in CDT. Compare date-only (year/month/day) rather than raw Date objects to prevent midnight boundary false positives. (PITFALLS.md Pitfall 7)

6. **Duplicate email in same DRA batch creates two rows for one referee** — the deduplication check scans the sheet for existing emails, but when processing a batch, row 1 may not be written yet when row 2 (same email) is checked. Also check the in-memory batch payload for duplicates before scanning the sheet. (PITFALLS.md Pitfall 4)

---

## Implications for Roadmap

The dependency chain is strict and was validated by all four research files independently. The schema gate comes first; every subsequent phase depends on stable column indices and correct data validation rules.

### Phase 1: v2.0 Schema Update
**Rationale:** Every other phase writes to the sheet. Column S data validation rejects v2.0 status values; column X purpose changes; the vocabulary change from Confirmed/Declined to Submitted is a prerequisite for any backend code. This phase costs almost nothing to do first and is catastrophic to skip.
**Delivers:** Updated column S dropdown (Not Sent / Pending / Submitted), column X header renamed to LateFlag, confirmed column mapping document for all downstream phases.
**Addresses:** Status vocabulary alignment (Pitfall 8); schema foundation for all referee-provided columns I-P.
**Avoids:** Silent data validation failures; status semantics confusion in downstream phases.
**Research flag:** Standard — direct update to existing setup scripts; no new platform APIs.

### Phase 2: Simplified DRA Nomination Form + nominateV2 Endpoint
**Rationale:** DRA nominations are the entry point for all data. Nothing else can be tested until nomination rows exist with tokens. This phase is also the safest to build independently — it modifies the DRA form but does not touch the referee or admin pages.
**Delivers:** Simplified DRA form (name + email per referee); doPost nominateV2 handler with email deduplication and token generation at append time; 18-element appendRow array with token in position 17; verified sheet rows after test submission.
**Addresses:** Simplified DRA form (P1 table stake); token generated at nomination time (Pitfall 5); email deduplication within batch (Pitfall 4); SheetJS removal.
**Avoids:** appendRow length mismatch (must send 18 elements: A-R, not just name+email); DRA accidentally sending empty strings for I-P that would overwrite future referee submissions (Anti-Pattern 1).
**Research flag:** Standard — all patterns established; no new research needed.

### Phase 3: Referee Detail Form + doGet/doPost Backend
**Rationale:** The referee form is the core of v2.0. It requires two Apps Script endpoints (getDetails, submitDetails) and the new HTML page. This phase has the highest integration surface: token lookup, deadline check, field writes, status update, late flag, pre-fill, six UI states. Build and test endpoints before building the HTML page.
**Delivers:** doGet getDetails endpoint; doPost submitDetails endpoint; `referee-details.html` with all six UI states; verified end-to-end flow from token link to submitted data in sheet.
**Addresses:** All P1 table stakes — token-secured form, all referee detail fields, doGet returns prior submission, doPost writes to correct columns, status transitions, late submission flag, success and error states, mobile-responsive layout (reuse nomination form CSS).
**Avoids:** appendRow in submitDetails (Pitfall 3 — must use row update, not append); blocking re-submission before deadline (Anti-Pattern 4); client-side-only required field validation (server-side validation required for availability and age, Pitfall 6); token URL containing PII beyond the UUID.
**Research flag:** Needs careful integration testing. Use the PITFALLS.md "looks done but isn't" checklist (7 items) as the acceptance criteria gate before declaring phase complete.

### Phase 4: Email Admin Page + getAllNominees Endpoint
**Rationale:** Admin page depends on referee form URL being finalized — it embeds that URL in every mailto link body. doGet getAllNominees is a read-only batch operation, simpler than Phase 3 endpoints. This phase must come last in the sequence for this reason.
**Delivers:** `email-admin.html` with nominee table, status display, and pre-composed Outlook mailto links; doGet getAllNominees endpoint; P3 features (visual de-emphasis for Submitted rows, COUNTIF formulas) can be added here at minimal cost.
**Addresses:** Admin page with mailto links (P1 table stake for assignor workflow); status visibility per nominee.
**Avoids:** Writing column T (SentAt) automatically — server never sends email, T cannot be auto-timestamped (Anti-Pattern 3); mailto URL body exceeding 1800 characters (STACK.md Section 5); getAllNominees returning tokens is acceptable per PROJECT.md security posture, but admin page URL must remain unlisted.
**Research flag:** Standard — mailto link construction and Outlook length limit are fully documented in STACK.md with code examples.

### Phase Ordering Rationale

- Schema update must precede all other phases because column S data validation will silently corrupt status writes from any phase that runs against an unupdated schema.
- Simplified DRA form (Phase 2) can be built and tested in isolation before referee or admin pages exist; it produces the rows the other phases need for end-to-end testing.
- Referee form (Phase 3) requires working nominateV2 rows to test against but does not depend on the admin page existing.
- Admin page (Phase 4) must come last because its mailto links embed the referee form URL, which isn't finalized until Phase 3 is deployed.
- Token generation at nomination time (Phase 2) makes the admin page a pure read operation — no write-at-admin-load complexity, no race conditions.

### Research Flags

Phases needing deeper review during planning:
- **Phase 3 (Referee Detail Form):** The six UI states, the "late submission" vs "past deadline — closed" distinction, and the server-side required-field validation are the most nuanced behaviors in v2.0. The phase plan should include explicit test assertions from PITFALLS.md as acceptance criteria, not just feature descriptions.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Schema Update):** Direct update to existing setup scripts; confirmed column indices; no new platform APIs.
- **Phase 2 (DRA Form):** Simplified version of already-working nomination form; removal is lower risk than addition.
- **Phase 4 (Admin Page):** Read-only data fetch + mailto link construction; fully documented patterns.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All decisions derived from existing working codebase or official Apps Script docs; MEDIUM item is the ~2000-char mailto limit (community-reported, consistent across sources, not in official Microsoft docs) |
| Features | HIGH | Requirements from PROJECT.md; feature boundaries are explicit; MEDIUM item is final schema option A vs B — resolved by ARCHITECTURE.md recommendation (Option A) |
| Architecture | HIGH | Based on direct codebase inspection; all column indices verified; no new platform APIs; CORS behavior already confirmed by v1.0 nomination form working cross-origin from GitHub Pages |
| Pitfalls | HIGH | 8 critical pitfalls with specific column indices, Apps Script behavior, and test assertions; derived from codebase inspection + platform behavior documentation |

**Overall confidence: HIGH**

### Gaps to Address

- **Status vocabulary: "Submitted" vs "Completed"** — ARCHITECTURE.md and PITFALLS.md use "Completed" while FEATURES.md uses "Submitted." These are used interchangeably across the research files. Pick one before Phase 1 writes the data validation rule. This is a 30-second decision; it must happen before any code runs.

- **Schema option A confirmation with assignor** — Research recommends Option A (referee writes to I–P) with HIGH confidence. Phase 1 planning should confirm the assignor accepts that columns formerly associated with DRA data will now contain referee-provided data. No code risk — just an expectation-setting conversation.

- **SentAt column T** — In v2.0 the server never sends email, so T cannot be auto-written. Leave blank, or provide an optional "mark as sent" button on the admin page. ARCHITECTURE.md identifies the gap; Phase 4 planning must resolve it before building the admin page.

- **Spreadsheet upload on simplified DRA form** — ARCHITECTURE.md recommends retaining it with a 4-column template (name, last name, email, DRA notes); FEATURES.md marks it as an anti-feature given only 2-3 fields. This is a scope decision for Phase 2 planning; not a research gap.

- **"Truly closed" vs "late-but-accepting" states** — Research documents both concepts but the exact trigger for the hard-close state (a second Script Property? a separate named range?) is not specified. Phase 3 planning should define this before building the referee form's read-only state.

---

## Sources

### Primary (HIGH confidence)
- Existing codebase: `spring-state-cup-nomination.html` — confirmed TEMPLATE_HEADERS array, appendRow structure, SheetJS version, CSS variables
- Existing codebase: `scripts/setup-confirmation-columns.gs` — confirmed v1.0 status values in requireValueInList(), column indices R=18, S=19 (1-based)
- `.planning/phases/01-sheet-schema/01-01-SUMMARY.md` — confirmed Phase 1 decisions: ConfirmationDeadline named range at Z1, column S conditional formatting, four-value dropdown
- `PROJECT.md` — v2.0 workflow decisions: token reuse, late submissions with flag, referee edits until deadline, mailto via Outlook, security posture
- [Properties Service Guide — Google for Developers](https://developers.google.com/apps-script/guides/properties) — PropertiesService scoping and usage
- [Class PropertiesService — Google for Developers](https://developers.google.com/apps-script/reference/properties/properties-service) — API reference
- [Lock Service — Google for Developers](https://developers.google.com/apps-script/reference/lock) — LockService.getScriptLock()
- [Named Range — Google for Developers](https://developers.google.com/apps-script/reference/spreadsheet/named-range) — getRangeByName() behavior
- [HTML readonly attribute — MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/readonly) — disabled vs readonly behavior

### Secondary (MEDIUM confidence)
- [Mailto links guide — mailslurp.com](https://www.mailslurp.com/blog/mailto-links-explained/) — URL encoding requirements; cross-verified with MDN URL encoding spec
- [mailto character limit — geeklog.adamwilson.info](https://geeklog.adamwilson.info/article/96/There-is-a-maximum-length-on-mailto-links-on-windows) — ~2000-char Windows/Outlook limit; consistent across community sources, absent from official Microsoft docs

---

*Research completed: 2026-03-19*
*Ready for roadmap: yes*
