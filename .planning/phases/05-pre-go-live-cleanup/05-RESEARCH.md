# Phase 5: Pre-Go-Live Cleanup - Research

**Researched:** 2026-03-22
**Domain:** Source code cleanup — placeholder replacement, GAS deployment consolidation, spreadsheet data entry
**Confidence:** HIGH (all findings are direct codebase reads, no external lookups required)

---

## Summary

Phase 5 is pure tech debt closure. All four items were catalogued in v2.0-MILESTONE-AUDIT.md (2026-03-21) and confirmed by reading every relevant source file directly. There is nothing architectural to research — every change is a specific value substitution or spreadsheet cell entry.

The two most important items are the DRA placeholder emails (real risk: fake emails in the sheet if those DRAs use the form before fix) and the ConfirmationDeadline (the deadline feature is completely inert until a date is entered in Z1). The URL consolidation requires creating a new GAS deployment and updating three files. The REF_FORM_URL source mismatch is cosmetic — the runtime PropertiesService value was already set and verified working in Phase 4.

**Primary recommendation:** Fix all four items in a single pass. The DRA emails and deadline require the user to supply values not currently in the repo. The URL consolidation and REF_FORM_URL source update are mechanical changes the planner can specify precisely.

---

## Exact Current State (Direct Code Reads)

### Item 1: DRA Placeholder Emails

**File:** `spring-state-cup-nomination.html`
**Lines:** 220-223

```html
<!-- TODO: Confirm Don Eubank's email before go-live -->
<option value="Don Eubank|TODO_eubank@email.com|SRA">Don Eubank (SRA)</option>
<!-- TODO: Confirm Mark Herrington's email before go-live -->
<option value="Mark Herrington|TODO_herrington@email.com|SYRA">Mark Herrington (SYRA)</option>
```

**What must change:** Replace `TODO_eubank@email.com` and `TODO_herrington@email.com` with real email addresses. The option value format is `Name|email|District` — the pipe-delimited format is parsed by `split('|')` in the form's change handler and submission logic.

**Information gap:** The real email addresses for Don Eubank (SRA) and Mark Herrington (SYRA) are not present anywhere in the codebase. The planner must include a task that asks the user to supply these values before the edit can be made.

**Context for surrounding options (for reference):**
- Wes Caouette: `wescaouette@att.net`
- Donovan Eubank: `donovanceubank@hotmail.com`
- Don Barnett: `centralregiondra@outlook.com`
- Glen Garrett: `glengarrett24@gmail.com`
- Tony Moran: `moran.ant4@gmail.com`
- Jason Odell: `jodell32@hotmail.com`
- Steve Cullen: `steve.cullen.08@gmail.com`
- State Cup Assignor: `jerickson@tnsoccer.org`

Note: Don Eubank (SRA) is a different person from Donovan Eubank (Mid-Western DRA). Both are in the dropdown.

---

### Item 2: REF_FORM_URL Source/Runtime Mismatch

**File:** `scripts/nominatev2.gs`
**Lines:** 436-437

```javascript
// TODO: Set to GitHub Pages URL before Phase 4 (e.g., https://<user>.github.io/StateCup_RefNoms/referee-details.html)
'REF_FORM_URL': 'TBD — set to GitHub Pages URL before Phase 4'
```

**Runtime state:** The PropertiesService value was updated and verified working during Phase 4 checkpoint (confirmed in Phase 4 VERIFICATION.md). The admin page's mailto links include the correct token-secured form URL in the email body. The source code just hasn't been updated to match.

**What the GitHub Pages URL is:** The git remote is `https://github.com/615jess/statecup-refnoms.git`. GitHub Pages for this repo deploys from the `main` branch root. The URL is:
`https://615jess.github.io/statecup-refnoms/referee-details.html`

**Confidence:** MEDIUM. The GitHub Pages URL is derived from the repo name and owner. However, the user must confirm:
1. GitHub Pages is actually enabled on this repo (no CNAME file was found in the repo, which is consistent with using the default `github.io` subdomain)
2. The repo name slug is `statecup-refnoms` (confirmed from git remote URL)
3. The user (615jess) is the Pages owner

The Phase 4 checkpoint confirmed the runtime REF_FORM_URL property is already set and working, so whatever URL is currently in PropertiesService is the correct value. The source code update should match that runtime value exactly. The planner should instruct the user to verify the runtime value first, then update source to match.

**What must change in source:** Replace the `'REF_FORM_URL'` string value in `setTournamentConstants()`. The entire function body for context:

```javascript
props.setProperties({
  'ASSIGNOR_EMAIL': 'jerickson@tnsoccer.org',
  'WEEKEND_1_DATES': 'May 16 & 17, 2026',
  'WEEKEND_2_DATES': 'May 23 & 24, 2026',
  'REF_FORM_URL': 'TBD — set to GitHub Pages URL before Phase 4'  // <-- this line
});
```

No re-running of `setTournamentConstants()` is needed — the runtime PropertiesService value is already correct. This is a source-only update for developer clarity.

---

### Item 3: Three Different GAS Deployment URLs

**Current state (exact URLs from each file):**

| File | Constant Name | Deployment ID prefix | Line |
|------|--------------|----------------------|------|
| `spring-state-cup-nomination.html` | `SHEET_URL` | `AKfycbyK7iYFG7d...` | 294 |
| `referee-details.html` | `SCRIPT_URL` | `AKfycby996qdKYY...` | 390 |
| `admin.html` | `SCRIPT_URL` | `AKfycbyMjgbP4I2...` | 259 |

Full URLs:
- nomination: `https://script.google.com/macros/s/AKfycbyK7iYFG7dx8eAaiUreQAC5yowwxzW8vg2QrtGc6z3WKO2K3OWQlR_YnwLDiz3eTQs/exec`
- referee-details: `https://script.google.com/macros/s/AKfycby996qdKYYwNJjlJ8WE32Npve7e72Ih546_D8ExItU9OPrC4StbODRoOd4kr1qwB1F6/exec`
- admin: `https://script.google.com/macros/s/AKfycbyMjgbP4I21oZ03smJR8SI-oeG3oiwx3tdk3QDDdoAsbve9lQDWotHmRbQzw4TFqhWy/exec`

**Why this requires a new GAS deployment:** Apps Script deployments are immutable — you cannot update the code behind an existing `/exec` URL. Each deployment is a snapshot. To have a single URL that serves all routes (nominateV2, submitDetails, markSent, getDetails, getAllNominees), a new deployment must be created from the current code state (all four .gs files as they exist in Phase 4).

**Routes each page currently uses:**
- `spring-state-cup-nomination.html`: POST only, `action=nominateV2`
- `referee-details.html`: GET (token lookup), POST `action=submitDetails`
- `admin.html`: GET `?action=getAllNominees`, POST `action=markSent`

All routes are present in the current Phase 4 code. The Phase 4 deployment (`AKfycbyMjgbP4I2...`) already has all routes — this is what admin.html uses. The question is whether that deployment also serves the Phase 2 and Phase 3 routes.

**Key insight:** The Phase 4 `adminemail.gs` was added to the same Apps Script project as nominatev2.gs and refdetails.gs. The Phase 4 deployment (`AKfycbyMjgbP4I2...`) was created with all four .gs files in scope. So the Phase 4 deployment URL already handles all routes. The consolidation step is: update `spring-state-cup-nomination.html` and `referee-details.html` to use the Phase 4 admin deployment URL.

**Verification needed:** The planner should instruct the user to verify the Phase 4 deployment URL works for nominateV2 before switching. Alternatively, creating a fresh new deployment from the current code state accomplishes the same goal with certainty.

---

### Item 4: ConfirmationDeadline Not Set

**Named range:** `ConfirmationDeadline` at cell Z1 in the Google Sheet.

**Current state:** The named range infrastructure is in place. `_getDeadlineState()` in refdetails.gs reads this range. When the cell is empty (or contains a non-Date value), the function returns `{ state: 'open', display: '' }` — deadline enforcement is completely inactive.

**Effect of leaving it unset:** Referees can submit at any time with no deadline enforcement. The late banner never shows. The `LateFlag` column never gets set to 'Y'. Hard-close never triggers. The form works fine; it just never enforces timing.

**What the deadline controls:**
- `state: 'open'` — before deadline, normal form
- `state: 'late'` — 0-3 days after deadline, late banner shown, LateFlag='Y' on first submit
- `state: 'hard_closed'` — 3+ days after deadline, form shows closed state, no submissions accepted

**What value to enter:** Any valid date. Entering a date in Z1 activates the deadline system. The planner should ask the user to provide the actual tournament response deadline date. Based on tournament dates (May 16-17 and May 23-24, 2026), a deadline of approximately late April 2026 would be typical, but the assignor decides.

**How to enter it:** Open the Google Sheet, navigate to cell Z1 (or use the named range box at top-left to jump to `ConfirmationDeadline`), and type a date (e.g., `4/30/2026`). The cell must contain a Date value that Google Sheets recognizes as a date, not a text string.

---

## Complications and Risks

### URL Consolidation Complication

The "create one final deployment" approach requires a human action in the GAS editor. The workflow is:
1. Open Extensions > Apps Script
2. Verify all four .gs files are present (nominatev2.gs, refdetails.gs, adminemail.gs, setup-schema-v2.gs)
3. Deploy > New deployment > Web app > Execute as Me > Anyone
4. Copy the new /exec URL
5. Update `SHEET_URL` in `spring-state-cup-nomination.html` (line 294)
6. Update `SCRIPT_URL` in `referee-details.html` (line 390)
7. `admin.html` line 259 already has the Phase 4 URL; if using a new deployment, update it too

**Risk:** If the new deployment URL is used before testing, it could break live functionality. Recommended approach: test the new deployment URL against one route before switching all pages.

**Alternative:** Since the Phase 4 deployment already has all routes, simply point `spring-state-cup-nomination.html` and `referee-details.html` at the Phase 4 admin URL (`AKfycbyMjgbP4I2...`). This avoids creating a new deployment. The audit's stated goal ("one final deployment") is met because the Phase 4 deployment IS the "final" deployment with all code. This is simpler and lower-risk.

### REF_FORM_URL Runtime Value Unknown from Source

The source code update requires knowing the actual runtime value in PropertiesService. The planner cannot hard-code the GitHub Pages URL without user confirmation that:
1. GitHub Pages is enabled on the repo
2. The URL in PropertiesService matches the expected `https://615jess.github.io/statecup-refnoms/referee-details.html`

The safest task design: instruct the user to check the runtime value in Apps Script (Project Settings > Script Properties > REF_FORM_URL) and use that exact value in the source update.

---

## Other Potential Cleanup Items (Scan Results)

A full `grep` scan of all `.gs` and `.html` files for TODO, FIXME, TBD, and placeholder patterns found:

1. `scripts/nominatev2.gs` lines 436-437 — REF_FORM_URL (documented above)
2. `spring-state-cup-nomination.html` lines 220-223 — DRA placeholder emails (documented above)
3. `spring-state-cup-nomination TEST.html` — this file exists in the working directory but is NOT committed to git (it appears in `git status` as untracked). It is a pre-pivot test file. No action needed.

**No other undocumented TODO/FIXME/placeholder values exist in committed source files.**

The `SETUP-INSTRUCTIONS.txt` file contains v1.0-era Apps Script code (the old doPost handler before the v2.0 pivot). It is not used by any live page. It could be removed as part of cleanup, but the audit did not flag it. Recommend treating it as out of scope.

---

## Sequencing Recommendation

The four items can be done in any order but this sequence minimizes risk:

1. **DRA emails** — requires user to supply email addresses; get this information first
2. **ConfirmationDeadline** — requires user to decide on a deadline date; can happen in parallel with #1
3. **REF_FORM_URL source update** — requires user to confirm the runtime value; then it's a one-line code change
4. **URL consolidation** — requires a new deployment OR confirms Phase 4 URL handles all routes; lowest risk last

Items 1, 2, and 3 are each independent. Item 4 is independent but involves a human GAS deployment step.

---

## Sources

### Primary (HIGH confidence)
- Direct read of `spring-state-cup-nomination.html` — confirmed placeholder values at lines 220-223
- Direct read of `scripts/nominatev2.gs` — confirmed TBD value at line 437, confirmed full `setTournamentConstants()` function body at lines 426-446
- Direct read of `referee-details.html` — confirmed SCRIPT_URL at line 390
- Direct read of `admin.html` — confirmed SCRIPT_URL at line 259
- Direct read of `.planning/v2.0-MILESTONE-AUDIT.md` — confirmed all 4 tech debt items, severity ratings
- Direct read of `.planning/phases/04-email-admin-page/04-VERIFICATION.md` — confirmed runtime REF_FORM_URL was set and working, confirmed Phase 4 deployment URL
- Direct read of `.planning/phases/03-referee-detail-form/03-03-SUMMARY.md` — confirmed REF_FORM_URL was left as TODO through Phase 3
- Direct read of `scripts/refdetails.gs` — confirmed `_getDeadlineState` behavior when Z1 is empty

### Secondary (MEDIUM confidence)
- GitHub Pages URL `https://615jess.github.io/statecup-refnoms/referee-details.html` — derived from git remote URL `https://github.com/615jess/statecup-refnoms.git`; requires user confirmation that GitHub Pages is enabled

---

## Metadata

**Confidence breakdown:**
- Item 1 (DRA emails): HIGH for what to change, LOW for what to change it TO (values not in codebase)
- Item 2 (REF_FORM_URL): HIGH for what needs changing, MEDIUM for the actual GitHub Pages URL
- Item 3 (URL consolidation): HIGH for current state, MEDIUM for recommended consolidation approach (Phase 4 URL vs. new deployment)
- Item 4 (ConfirmationDeadline): HIGH for what to do, LOW for the actual deadline date (user decision)

**Research date:** 2026-03-22
**Valid until:** Indefinite — this research is based on static codebase analysis, not external APIs
