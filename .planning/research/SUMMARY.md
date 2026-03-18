# Project Research Summary

**Project:** State Cup Referee Nominations — Confirmation System (v1.0)
**Domain:** Token-based email RSVP / availability confirmation, Google Apps Script + Sheets + GitHub Pages
**Researched:** 2026-03-17
**Confidence:** HIGH overall (well-established platform, existing codebase confirms patterns; one MEDIUM area: email quota numbers)

---

## Executive Summary

This is a small-scale, single-cycle event confirmation system for approximately 50–100 soccer referees. The assignor sends personalized emails via Google Apps Script; each email contains a unique link that takes the referee to a pre-filled confirmation page on GitHub Pages. The referee reviews their availability for two tournament weekends, adjusts if needed, and submits. That response writes back to the existing Google Sheet. The entire system runs on infrastructure already in place — no new hosting, no external services, no backend beyond Apps Script.

The recommended approach is fully additive to the existing codebase: one new static HTML file (`confirm.html`) on GitHub Pages, three new Apps Script functions (`doGet`, `sendConfirmationEmails`, `closeConfirmations`), one extended `doPost` route, and eight new columns (R–Y) appended to the existing nominations sheet. `Utilities.getUuid()` generates tokens; `MailApp` sends email with `htmlBody`. The confirmation page fetches pre-fill data on load via a GET request, then POSTs the referee's response. A custom Google Sheet menu gives the assignor control over when emails go out and when the confirmation window closes.

The highest-consequence risks are not technical — they are process and data-integrity concerns: adding columns in the wrong position would silently corrupt the existing nomination data; failing to wrap email sends in try/catch leaves the assignor with false confidence about which referees were notified; and regenerating tokens on re-send breaks links for referees who haven't yet confirmed. All three are prevention-by-design issues that must be addressed in the build plan, not discovered in production.

---

## Key Findings

### Recommended Stack

The confirmation system requires no new infrastructure. Everything runs on the same stack as the existing nomination form. `MailApp` (not `GmailApp`) is the correct email service: it requires a narrower OAuth scope, avoids polluting the assignor's Sent folder, and fully supports `htmlBody` and `replyTo`. `Utilities.getUuid()` is the correct token generator: built-in, cryptographically random (122-bit UUID v4), URL-safe, and stored once per referee row.

The confirmation page lives on GitHub Pages as a static HTML file mirroring the nomination form's structure. It communicates with the existing Apps Script via JSON-returning `ContentService` responses — the same CORS-compatible pattern already proven by the nomination form. No new Apps Script deployment URL is needed; the existing `/exec` URL handles both GET (new) and POST (extended) after a version redeploy.

**Core technologies:**
- `MailApp.sendEmail()` with `htmlBody`: personalized HTML confirmation emails — narrower OAuth scope than GmailApp, no Sent folder pollution
- `Utilities.getUuid()`: token generation — built-in, cryptographically random, URL-safe
- `doGet(e)` + `ContentService.createTextOutput()`: token validation endpoint — returns referee JSON to pre-fill confirmation form
- `doPost(e)` with `action` routing: extended nomination endpoint — adds `submitConfirmation` branch without touching existing nomination logic
- `SpreadsheetApp.getUi().createMenu()`: assignor email trigger and close mechanism — no separate admin UI needed
- `LockService.getScriptLock()`: concurrent write guard — one-liner precaution for simultaneous submissions
- Template literal `htmlBody` with inline styles: email HTML — avoids HtmlService (wrong tool for email), no CSS classes (stripped by email clients)

**Versions / quotas to verify before build:**
- MailApp daily quota: 100 (personal Gmail) vs 1,500 (Workspace). `tnsoccer.org` is likely Workspace — confirm before implementation. See: https://developers.google.com/apps-script/guides/services/quotas

### Expected Features

The feature set is well-defined. The system has a hard boundary: table stakes that are non-negotiable, a set of low-complexity differentiators that should be included given how easy they are, and a clear anti-feature list to keep scope from expanding.

**Must have (table stakes — do not cut):**
- UUID token per referee row, generated once and stored permanently
- Personalized HTML confirmation email with name, tournament dates, and a single CTA link
- Confirmation page: `doGet` token validation + pre-filled form (weekend availability, hotel, notes)
- Independent confirm/decline per weekend (Weekend 1 and Weekend 2 are separate)
- Hotel field per weekend, conditional on that weekend being confirmed
- `doPost` writes referee's response to separate columns (V–Y), preserving DRA's original data (M–O)
- Confirmation Status column (R–Y block): `Not Sent` / `Pending` / `Confirmed` / `Declined`
- Success screen summarizing what was submitted; error state with assignor contact on failure
- Mobile-responsive form: 16px+ body font, 44px+ touch targets, single-column at 560px breakpoint, no horizontal scroll at 320–428px
- Idempotent re-submission: the GET returns current sheet data; re-submitting updates the same row, not inserts a new one

**Should have (differentiators — all low complexity, include in v1.0):**
- Personalized subject line including referee name
- Email body listing the referee's specific nominated weekends (not generic "the tournament")
- Success screen summary of exactly what was submitted (prevents "did you get it?" emails)
- Assignor contact address in email body (not just From field)
- "Confirmations closed" response when assignor has closed the window
- `COUNTIF` summary formula in sheet for Confirmed / Pending / Declined running totals (zero code, just formula)

**Defer to v2+ or never build (anti-features):**
- Automated reminder emails / scheduled re-sends
- Separate tracking dashboard outside the sheet
- Login / authentication for referees
- Full withdrawal / opt-out flow (phone call between referee and DRA is the correct channel)
- Referee profile history across tournament years
- Email open / click tracking (requires external service)
- In-email one-click confirmation (email client prefetch breaks GET-with-side-effects)
- SMS / push notifications

### Architecture Approach

The architecture is strictly additive to the existing system. The confirmation page (`confirm.html`) lives on GitHub Pages alongside the nomination form. It loads referee data via a GET to the existing Apps Script endpoint (new `doGet` function), renders a pre-filled form in one of four page states (loading / form / already-confirmed / error), and POSTs the referee's response back. The Apps Script routes requests by `action` parameter — existing nomination submissions continue unchanged. All confirmation data lands in new columns R–Y appended to the right of the existing 17-column sheet, preserving every existing column reference.

**Major components:**

1. `confirm.html` (GitHub Pages) — referee-facing page; manages 5 UI states; reads token from URL; GET on load, POST on submit; mirrors nomination form's CSS
2. `doGet(e)` in Apps Script — receives `action=getConfirmation&token=...`; scans column R for token; returns referee JSON or error; enables CORS automatically via ContentService
3. `doPost(e)` extended in Apps Script — adds `action=submitConfirmation` branch; validates token; writes referee response to columns V–Y; updates status in column S; existing nomination branch untouched
4. `sendConfirmationEmails()` + `onOpen()` menu in Apps Script — assignor-facing trigger; scans for rows with email but no token; generates UUID, writes to col R, sets col S to Pending, sends `MailApp` email; wrapped in try/catch per row; reports results via `getUi().alert()`
5. `closeConfirmations()` in Apps Script — sets remaining Pending rows to "Closed — No Response"; reachable via Sheet menu
6. Google Sheet columns R–Y — confirmation token, status, timestamps, referee's confirmed availability/hotel/notes (separate from DRA's original data)

**Key patterns:**
- Action-based routing in `doGet`/`doPost` (Apps Script has no path routing)
- Batch `getValues()` for token lookup — one API call regardless of sheet size; never call `.getValue()` per row in a loop
- Idempotent writes — check existing status before writing; return success if already confirmed
- Inline styles only in email HTML — no `<style>` blocks, no CSS variables, no Flexbox/Grid
- Append-only column additions — never insert before existing columns

### Critical Pitfalls

1. **Sheet column insertion breaks existing nomination script** — Adding new columns anywhere but the right end shifts all existing column indices, causing silent data corruption in nomination submissions. Prevention: append columns R–Y after the existing 17 columns; verify the nomination form still works after adding them; freeze the sheet schema before writing any code.

2. **Apps Script deployment versioning** — Code changes do not go live on the `/exec` URL until a new deployment is explicitly created. Testing on `/dev` and forgetting to redeploy is the single most common Apps Script debugging trap. Prevention: always create a new deployment after changes; test against the `/exec` URL, not `/dev`; document the current deployment ID.

3. **Token regeneration on re-send invalidates existing links** — If the email-send function regenerates tokens for rows that already have one, referees who received the first email but haven't confirmed yet have broken links. Prevention: check if column R is already populated before generating; only generate if empty: `const token = existingToken || Utilities.getUuid();`

4. **Partial email batch send with no error reporting** — If `MailApp` throws mid-loop (quota exceeded, bad address), a naive loop aborts silently and leaves some rows in an unknown state. Prevention: wrap each `MailApp.sendEmail()` in try/catch; collect failures; report both sent and failed counts to assignor via `getUi().alert()`.

5. **Email HTML rendered broken** — Gmail and Outlook strip `<style>` blocks and CSS variables. Email built with `var(--navy)` or `class="header"` will arrive with no color or layout. Prevention: inline styles only, literal hex values, no CSS classes in email HTML. The email template in STACK.md follows this correctly.

6. **CORS on GET requests** — Apps Script's `ContentService` automatically adds `Access-Control-Allow-Origin: *` for JSON responses, but this must be verified empirically from the GitHub Pages domain. Do not assume it works — test the GET endpoint from the actual confirmation page in a browser before moving to POST implementation.

---

## Implications for Roadmap

Research establishes a clear dependency chain. The sheet must exist before the script can write to it; the script endpoints must be deployed before the confirmation page can be tested end-to-end; the confirmation page URL must be finalized before emails can be sent (because the URL is embedded in the email body). This dictates build order.

### Phase 1: Sheet Schema and Data Foundation

**Rationale:** The Google Sheet is the prerequisite for everything else. No code can be written or tested without the columns in place. This is also the highest-consequence change to get wrong — wrong column placement silently breaks existing nomination submissions. Do it first, verify nominations still work, then freeze the schema.

**Delivers:** Confirmed column layout R–Y; verified nominations still write correctly; column constants for the Apps Script (`TOKEN_COL = 18`, etc.)

**Addresses:** "Confirmation Token", "Confirmation Status", timestamps, referee response columns (from FEATURES.md table stakes)

**Avoids:** Pitfall — sheet column insertion breaking existing script; Pitfall — script referencing wrong column indices

### Phase 2: Apps Script Backend (doGet + doPost + LockService)

**Rationale:** The two Apps Script endpoints are the backbone of the system and can be built and unit-tested before the confirmation HTML page exists. Test `doGet` by hitting the `/exec?action=getConfirmation&token=TEST` URL directly in a browser. Test `doPost submitConfirmation` by POSTing a manually crafted payload with a token written directly into the sheet.

**Delivers:** Working `doGet` returning referee JSON by token; working `doPost submitConfirmation` writing to columns V–Y and updating column S; `LockService` guard on writes; action-based routing that leaves existing nomination handling untouched

**Uses:** `Utilities.getUuid()`, `ContentService.createTextOutput()`, `LockService.getScriptLock()`, batch `getValues()` for token lookup

**Implements:** Components 2 and 3 from the architecture

**Avoids:** Pitfall — doGet/doPost confusion; Pitfall — broken nomination flow after changes; Pitfall — race conditions on concurrent writes

### Phase 3: Confirmation Page (confirm.html on GitHub Pages)

**Rationale:** Built after the Apps Script endpoints are verified working. The page depends on both `doGet` (for pre-fill) and `doPost` (for submission). Building it third means the backend is stable and the frontend is the variable being tested, not both simultaneously.

**Delivers:** `confirm.html` with all 5 UI states (loading, form, already-confirmed, error, success); pre-filled weekend availability and hotel fields; notes textarea; mobile-responsive layout matching nomination form; success screen summarizing what was submitted

**Addresses:** All UX table stakes from FEATURES.md; mobile requirements; idempotent re-submission; "closed" response state; success/error feedback

**Avoids:** Pitfall — mobile tap targets; Pitfall — loading state gap on cold-start Apps Script; Pitfall — CORS on GET (verify empirically here)

### Phase 4: Email Sending and Assignor Controls

**Rationale:** Email sending is last because the confirmation page URL must be finalized before it can be embedded in email bodies. This phase finalizes the assignor-facing workflow: the custom Sheet menu, the email batch function, error reporting, and the close-confirmations mechanism.

**Delivers:** `sendConfirmationEmails()` with per-row try/catch and count reporting; `closeConfirmations()` for end-of-window cleanup; `onOpen()` menu with both actions; HTML email template with inline styles, referee name, nominated weekends, and confirmation CTA; `replyTo` / `name` set for deliverability

**Uses:** `MailApp.sendEmail()` with `htmlBody`, `name`, `replyTo`; `SpreadsheetApp.getUi().createMenu()`; "confirmations closed" flag in script properties or sheet cell

**Avoids:** Pitfall — partial batch send with no error reporting; Pitfall — token regeneration on re-send; Pitfall — email HTML broken in Gmail/Outlook; Pitfall — emails counted against wrong Google account

### Phase 5: Hardening, Testing, and Deployment Checklist

**Rationale:** All components exist and are wired. This phase validates the full end-to-end flow, confirms deployment is on the correct Google account, verifies the assignor can authorize new OAuth scopes, and produces the deployment checklist.

**Delivers:** End-to-end test with real email addresses; confirmed MailApp quota account type (personal vs Workspace); assignor re-authorization completed; `COUNTIF` summary formulas added to sheet; `SETUP-INSTRUCTIONS.txt` updated with new columns and menu

**Avoids:** Pitfall — script runs under developer account quota instead of assignor's; Pitfall — re-authorization not planned for; Pitfall — assignor has no documentation for new menu

### Phase Ordering Rationale

- Sheet schema first because it is the single shared mutable resource; getting it wrong is the only change that could corrupt existing production data
- Apps Script backend second because endpoints can be tested independently without a browser; catching logic errors early is cheaper than finding them while debugging the HTML page
- Confirmation page third because it has no logic of its own — it delegates entirely to the two verified endpoints
- Email sending fourth because it embeds the confirmation page URL and represents the point of no return (once referees receive emails, tokens are live)
- Hardening fifth because it validates the complete system against real conditions, not simulated ones

### Research Flags

Phases with standard, well-documented patterns (research-phase not needed):
- **Phase 1 (Sheet Schema):** Pure spreadsheet column additions; no novel patterns
- **Phase 2 (Apps Script Backend):** All patterns are documented in STACK.md and ARCHITECTURE.md with code examples
- **Phase 3 (Confirmation Page):** HTML/CSS/JS pattern identical to existing nomination form; no new techniques
- **Phase 5 (Hardening):** Checklist and testing, not implementation

Phases where one specific item warrants verification during build (not full research-phase, but a deliberate test-first step):
- **Phase 3 — CORS on GET:** Do not assume `ContentService` GET responses include CORS headers. Open the `doGet` endpoint URL in a browser from the GitHub Pages domain and verify in DevTools before building the fetch call. This is a test, not research.
- **Phase 4 — Account quota:** Confirm whether `tnsoccer.org` is Google Workspace before sending any batch. If personal Gmail, the 100/day quota is a real constraint. One-minute check; not a research project.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommended APIs (MailApp, Utilities.getUuid, doGet/doPost, ContentService) are core Apps Script features stable since 2015; patterns confirmed by existing working nomination form |
| Features | HIGH | Table stakes derived directly from system requirements in PROJECT.md; confirmation system patterns are well-established in email-RSVP domain |
| Architecture | HIGH | Additive-only approach confirmed by reading existing codebase; action-based routing and column-append strategy are standard Apps Script patterns; CORS behavior confirmed by existing nomination form |
| Pitfalls | HIGH | Apps Script deployment versioning, MailApp batch behavior, and email HTML client compatibility are well-documented platform characteristics; column index fragility is a known Apps Script anti-pattern |

**Overall confidence:** HIGH

### Gaps to Address

- **Email quota — account type:** MEDIUM confidence on the 100 vs 1,500 threshold. Verify `tnsoccer.org` account type before Phase 4. If personal Gmail, design the batch send to handle partial completion gracefully (it should anyway per the pitfall prevention, but the quota constraint affects how urgently that matters).

- **CORS on doGet:** Apps Script documentation states ContentService responses include CORS headers for public deployments, but this must be verified empirically from the GitHub Pages domain. Address in Phase 3 before writing the fetch call.

- **Column constants — exact indices:** The sheet currently has 17 columns (A–Q). New columns start at R (index 17, 0-based). These indices must be verified against the actual sheet before writing any Apps Script column references. Minor; verify during Phase 1.

- **GitHub Pages URL for confirmation links:** The exact URL (`https://[org].github.io/StateCup_RefNoms/confirm.html`) depends on whether the repository is under a user or organization account. Confirm before Phase 4 (email sending embeds this URL).

- **"Confirmations closed" flag mechanism:** Research recommends a sheet cell or Script Property for the closed flag. The exact implementation (cell in a "Config" row, named Script Property, etc.) should be decided before Phase 2 so the `doGet` and `doPost` handlers can check it consistently.

---

## Sources

### Primary (HIGH confidence)

- Apps Script platform training knowledge (cutoff August 2025) — MailApp, GmailApp, Utilities.getUuid, doGet/doPost, ContentService, LockService, SpreadsheetApp UI menu, HtmlService
- Existing project codebase (`spring-state-cup-nomination.html`, Apps Script deployment) — confirmed CORS behavior, doPost pattern, sheet column structure, CSS variables and color palette
- Project requirements (`PROJECT.md`) — confirmed scale (~50–100 referees), assignor workflow, infrastructure constraints

### Secondary (MEDIUM confidence)

- Apps Script quota documentation (training knowledge, not live-verified): 100 emails/day (personal Gmail), 1,500 emails/day (Workspace) — verify at https://developers.google.com/apps-script/guides/services/quotas before implementation

### Tertiary (not applicable)

No external web sources were available during research (WebSearch/WebFetch unavailable in this session). All findings are from training knowledge and direct codebase inspection. For a project of this complexity and maturity on a stable platform, this does not create meaningful gaps.

---

*Research completed: 2026-03-17*
*Ready for roadmap: yes*
