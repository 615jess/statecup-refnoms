# Pitfalls Research: v2.0 Referee Detail Collection Pivot

**Domain:** Adding "nominee provides own details" workflow to existing "nominator provides all" Google Apps Script + Sheets nomination system
**Project:** State Cup Referee Nominations — v2.0 milestone
**Researched:** 2026-03-19
**Confidence:** HIGH (derived from direct inspection of existing codebase, verified column map, and known Apps Script platform behavior)

---

## Scope of This Document

This file covers pitfalls specific to the v2.0 pivot: moving from a system where DRAs provide all 14 referee fields to one where DRAs provide only name + email and referees provide the rest via token-secured form. It does not re-cover general Apps Script pitfalls already documented in the v1.0 PITFALLS.md (token security, deployment versioning, CORS, email HTML, etc.). Those remain valid and should be reviewed alongside this document.

---

## Critical Pitfalls

### Pitfall 1: Sheet Schema Incompatibility — Columns Previously Written by DRA Are Now Left Blank

**What goes wrong:**
The existing sheet columns A–Q were designed assuming DRA provides all data. Columns E (Referee #), I (Phone), J (Age), K (Max Age as AR), L (Max Age as Referee), M (Availability), N (Hotel Weekend 1), O (Hotel Weekend 2), P (Day-Specific Notes) were all DRA-provided in v1.0. In v2.0, DRA submits only name + email, so those columns are blank at nomination time and must be filled by the referee later. If any downstream consumer (the assignor's formulas, conditional formatting, or column-width expectations) assumes those columns are populated immediately after nomination, the sheet will look broken or produce errors until the referee responds.

**Why it happens:**
The sheet schema was designed around the v1.0 data flow. No one reviewed whether the schema needs to be explicitly re-versioned or whether column headers/validation rules have hidden assumptions about DRA-provided data being present.

**How to avoid:**
- Audit each column A–Q for any validation rules that would reject a blank value. The existing `doPost` uses `appendRow()` — if the simplified form sends fewer fields, the array passed to `appendRow` must still align to the correct positional columns or the write will silently misalign.
- The simplified DRA form should still write a full 17-element array to `appendRow`, with empty strings for the referee-provided fields (I, J, K, L, M, N, O, P). Never change the array length or column positions.
- Add a note in the sheet (or update column headers) to indicate which columns are "DRA-provided" vs "Referee-provided" so the assignor is not confused by blanks.

**Warning signs:**
- Assignor opens the sheet after a v2.0 nomination and sees most columns empty — creates confusion about whether the submission worked
- `appendRow` call in the simplified form has fewer than 17 elements — data writes to wrong columns starting from where the array ends

**Phase to address:** Sheet schema migration planning — before any code changes to the nomination form

---

### Pitfall 2: The Spreadsheet Upload Feature Breaks When Form Fields Are Removed

**What goes wrong:**
The existing nomination form has a spreadsheet upload feature (SheetJS / XLSX) that reads a 13-column template (`TEMPLATE_HEADERS`) including Phone, Referee Age, Max Age as AR, Max Age as Referee, Weekend 1, Weekend 2, Hotel Weekend 1, Hotel Weekend 2, Day-Specific Limitations, DRA Notes. If the form is simplified to name + email only, the upload template becomes out of sync with the form. Two failure modes:

1. DRAs who saved the old template try to upload it — the upload code finds columns it no longer maps to form fields and either silently ignores them or errors.
2. The `downloadTemplate()` function still generates the 13-column template — DRAs download it, fill it out, upload it, and then wonder why age/availability wasn't saved.

**Why it happens:**
The upload feature is tightly coupled to the form's field set via `TEMPLATE_HEADERS` and the column-mapping logic in `handleUpload()`. Removing form fields without updating the upload template leaves a silent mismatch.

**How to avoid:**
- When simplifying the nomination form, update `TEMPLATE_HEADERS` to match the new minimal field set (First Name, Last Name, Email only, or whatever the final simplified field set is).
- Update `downloadTemplate()` to generate the new minimal template.
- Update the column-mapping in `handleUpload()` to only map fields that still exist in the form.
- If the simplified form removes the upload feature entirely (reasonable given there are only 2 fields), remove the SheetJS `<script>` tag and all upload-related HTML/JS to avoid loading a large library (xlsx.full.min.js is ~1MB) for no purpose.

**Warning signs:**
- A DRA uploads the old template — the referee count shows correctly but submitted data has blank fields
- No runtime error is thrown — the mismatch is silent

**Phase to address:** Nomination form simplification — the upload feature must be audited as part of this work

---

### Pitfall 3: Two-Writer Conflict — DRA Creates Row, Referee Updates It

**What goes wrong:**
In v2.0, two separate actors write to the same sheet row at different points in time:
- DRA creates the row (columns A-Q partial, plus token generated in column R)
- Referee updates the row later (columns V-Y via the detail form, plus column S status, column U ConfirmedAt)

If the referee's detail form writes to the row by appending a NEW row instead of updating the existing one, the sheet gets duplicate entries — one from the DRA (partial) and one from the referee (partial, different columns). This is the same class of bug as the v1.0 "append vs update" pitfall but is more consequential in v2.0 because the DRA row and referee row are meaningless independently.

Additionally, if the DRA re-nominates a referee who already has a row (same email), and the system creates a second row with a new token, the referee will only receive the link for the new row. Their old row (if partially filled from a previous cycle) is orphaned.

**Why it happens:**
The Apps Script `doPost` for the simplified nomination form uses `appendRow()` — the correct behavior for new nominations. But the referee detail form must use `findRowByToken()` + `getRange(...).setValues()` to update the existing row. If the referee detail endpoint accidentally calls `appendRow`, it creates a new orphaned row.

**How to avoid:**
- The referee detail endpoint (`doPost` with `action=submitDetails` or similar) must never call `appendRow`. It must always look up the existing row by token and use `setValues` to update specific columns.
- Add an explicit assertion at the top of the referee detail handler: if `findRowByToken()` returns null or -1, return an error — do not fall through to an append.
- Test this path explicitly: submit a detail form with a valid token and verify the row count in the sheet stays constant.

**Warning signs:**
- After a referee submits details, the sheet gains a new row instead of the existing row being updated
- The row count increases by 1 after each referee submission (indicates appending instead of updating)

**Phase to address:** Referee detail form Apps Script backend — critical to verify in integration testing

---

### Pitfall 4: Re-Nomination of the Same Referee — Token and Row Collision

**What goes wrong:**
The PROJECT.md decision is "reuse existing token for re-nominated referees." This means: if a DRA nominates Jane Smith (jane@example.com) and Jane already has a row in the sheet from this cycle, the system should find the existing row and update it rather than creating a second row.

Three distinct failure modes:

1. **Same DRA nominates Jane twice in one batch submission.** The nomination form processes rows sequentially. Row 1 creates Jane's entry and generates a token. Row 2 (also Jane) is processed immediately after — the deduplication check finds no existing row yet (the first row was just appended but the check looks for pre-existing rows). Result: two rows for Jane, two tokens, and the second email link is the one that works while the first is orphaned.

2. **Different DRA nominates Jane who is already in the sheet.** The lookup by email finds the existing row. If the decision is to update in-place (merge), the second DRA's name overwrites the first. The first DRA loses their nomination attribution.

3. **DRA nominates Jane, then Jane changes her email and DRA re-nominates with the new email.** The system creates a second row (old email doesn't match) — Jane has two valid tokens from two different rows, both going to different email addresses.

**Why it happens:**
De-duplication by email address is deceptively simple: "find row where column H = email." But it doesn't handle batch submissions, attribution preservation, or email changes.

**How to avoid:**
- For the same-batch duplicate (case 1): Before appending each row in a batch, check the in-memory list of rows already processed in this request — not just the sheet. If the same email appears twice in one batch, take the first and skip or log the second.
- For the cross-DRA re-nomination (case 2): Decide explicitly what "merge" means. Options: (a) reject with an error message showing which DRA already nominated them, (b) append as a new row with a different token (two rows = two links, only the most recent one matters), (c) update the existing row and overwrite DRA attribution. Pick one and document it. The simplest correct choice is (b) — append new row, use new token, last email wins. The old row becomes inert when the assignor ignores rows that never received a response.
- For the email-change case (case 3): Accept this as an acceptable edge case for this scale. With 7 DRAs and ~50–100 referees, this is unlikely and low consequence.

**Warning signs:**
- Sheet has two rows for the same referee name after a batch submission
- The `handleDuplication` logic checks only the sheet and not the current batch payload

**Phase to address:** Nomination form Apps Script backend — deduplication logic must be explicitly designed and tested

---

### Pitfall 5: Token Generated Before Row Exists vs. After Row Exists — Timing Race

**What goes wrong:**
The PROJECT.md decision is to generate the token when the DRA submits the nomination (not when the assignor sends emails, as in v1.0). This means the token must be generated inside the `doPost` handler that processes the nomination, stored in column R at the time of `appendRow`. If this step fails silently (e.g., the token write succeeds but the row is malformed), the referee's row exists without a token and can never be looked up by the referee's form.

Alternatively, if token generation is deferred to when the admin page generates mailto links (the v1.0 approach), there is a window where the row exists but has no token. If the assignor accidentally sends the admin page URL before tokens are generated, they see blank token cells and the mailto links contain an empty token parameter.

**Why it happens:**
In v1.0, token generation was deferred to Phase 4 (email admin) — that was acceptable because v1.0 had a clear "email send" trigger. In v2.0, the token must be present from the moment the row is created because the admin page generates mailto links that embed the token. If these steps are out of order, mailto links are broken.

**How to avoid:**
- Generate the token in the same `doPost` call that creates the nomination row. The 17-element array passed to `appendRow` should include the token at position 17 (0-based) = column R (1-based index 18). This atomically creates the row with the token.
- The `appendRow` array for v2.0 should be: `[timestamp, dra, email, district, ref_num, first, last, ref_email, '', '', '', '', '', '', '', '', '', token]` — 18 elements for columns A through R. The R-Y confirmation columns remain blank (columns 19–25).
- After `appendRow`, verify the token was written by reading back `sheet.getRange(lastRow, 18).getValue()` — though this adds an API call. For most cases, trust `appendRow` succeeds or let the entire doPost fail with an error.

**Warning signs:**
- Admin page shows blank token cells for rows that were just submitted
- Mailto links contain `?token=` with no value

**Phase to address:** Nomination form Apps Script backend — token generation at submission time

---

### Pitfall 6: Blank Required Fields in the Referee Detail Form Reach the Sheet

**What goes wrong:**
The referee detail form collects availability, age, gender, contact info, hotel needs, and notes. If the form's client-side validation is insufficient (or disabled on a mobile browser), a referee can submit the form with required fields blank. The Apps Script backend writes blank values to columns V-Y and sets Status to "Completed." The assignor now has a row showing "Completed" but with no availability data — which is the only data they need for assignments.

Compounding this: the assignor has no way to prompt the referee to re-submit because Status shows "Completed" and the form's re-visit behavior shows "you've already submitted." The referee thinks they're done.

**Why it happens:**
Client-side validation can be bypassed. Server-side validation is often an afterthought when the fields seem optional (e.g., "notes" is optional but "availability" is not).

**How to avoid:**
- The Apps Script `doPost` handler for referee detail submission must validate required fields server-side before writing to the sheet:
  - Availability (must select at least one weekend — RefWeekend1 or RefWeekend2 must not both be blank)
  - Age (required — used for assignment decisions)
  - Gender (required — used for assignment decisions)
- Return an error JSON if required fields are missing. The referee form handles the error state and shows a message without changing Status to "Completed."
- Do NOT set Status to "Completed" until server-side validation passes.
- Client-side validation is still important (prevents bad UX), but server-side is the contract.

**Warning signs:**
- Sheet has rows where Status = "Completed" but RefWeekend1 and RefWeekend2 are both blank
- Referee reports "I submitted but it accepted a blank form"

**Phase to address:** Referee detail form — both the form HTML and the Apps Script validation handler

---

### Pitfall 7: Deadline Enforcement Writes the Wrong Timestamp — "Late" Flag Logic

**What goes wrong:**
The PROJECT.md decision is: "late submissions accepted with a flag; referee sees a notice." This means the Apps Script must:
1. Read the deadline from the `ConfirmationDeadline` named range (cell Z1)
2. Compare against the current timestamp
3. If after deadline: write submission data, set a "Late" flag in the row, and return a response that tells the form to show the late notice

Two failure modes:

1. **Timezone mismatch:** The deadline cell Z1 stores a date value (e.g., May 15, 2026). The Apps Script compares `new Date()` (UTC) against the stored date. If the stored date has no time component, Google Sheets interprets it as midnight UTC. A submission at 8pm CDT (1am UTC next day) would be flagged "late" even though it was before midnight local time.

2. **Missing "Late" column:** If there is no dedicated column for the late flag, it may be stored in an overloaded field (e.g., appended to RefNotes as "[LATE]"). This makes the assignor's sheet harder to filter and is easy to accidentally strip.

**Why it happens:**
Date comparisons in Apps Script are UTC-native. The assignor thinks of the deadline in local time. The sheet stores dates in the spreadsheet's locale timezone, but Apps Script reads them as JavaScript Date objects which are UTC.

**How to avoid:**
- Decide on a "late" column before writing any deadline-check code. Options: (a) a dedicated column (e.g., column Z+1 or an existing header in the R-Y block, or a new column AA), (b) a flag value in the Status column (e.g., "Completed-Late"), (c) a field in RefNotes. The cleanest option is a separate boolean column ("IsLate") that the assignor can filter. This requires adding a column to the current R-Y schema.
- For timezone handling: store the deadline as a date-time value including the timezone offset, or always treat deadline midnight as "end of day in CDT" by using `new Date(deadline.setHours(23, 59, 59))` with explicit CDT offset math.
- Alternative: treat the deadline as a "day-of" cutoff by comparing only the date portion (year/month/day) and ignoring time. "Late" means submitted on a day after the deadline date. Simpler and less error-prone.

**Warning signs:**
- Referee submits at 11pm on deadline day and sees a "Late" notice even though it's before midnight
- The sheet has no column to filter "Late" submissions — the assignor has to read notes to find them

**Phase to address:** Referee detail form and Apps Script backend — deadline check logic and schema planning

---

### Pitfall 8: Status Dropdown Validation Rejects Referee-Written Status Values

**What goes wrong:**
Phase 1 (completed) added a data validation dropdown to column S restricting it to: `Not Sent, Pending, Confirmed, Declined`. In v2.0, the status lifecycle is different: referees provide details (not "confirm/decline" weekends) and the relevant statuses are different — something like `Not Sent, Pending, Completed` (and possibly `Completed-Late`). If the Apps Script attempts to write "Completed" to column S but the dropdown validation only allows "Not Sent, Pending, Confirmed, Declined," the write will fail with a data validation error.

**Why it happens:**
Phase 1 was designed for v1.0. The four status values were v1.0 semantic: "Confirmed" = referee confirmed their weekends. In v2.0, "Confirmed" is ambiguous — does it mean the referee confirmed their availability, or the assignor confirmed them for a game? The schema must be updated before the v2.0 backend writes status values.

**How to avoid:**
- Before writing any v2.0 Apps Script code that touches column S, update the data validation dropdown to the v2.0 status values.
- The Phase 1 setup script (`setup-confirmation-columns.gs`) can be adapted to run an update-only step: remove the old validation rule and apply the new one.
- The `setAllowInvalid(false)` setting means any write that doesn't match the list fails silently at the sheet level (the cell shows the value but it's flagged with a warning triangle). In Apps Script, `setValues()` does not throw an exception when validation fails — it just writes the value and the cell gets a visual warning. The data is written but the sheet shows it's invalid. This is a silent mismatch.
- Verify the exact status values for v2.0 before Phase 1 schema updates are applied to production.

**Warning signs:**
- Column S cells show a red/orange warning triangle after the Apps Script writes a status value
- The Apps Script reports success but the sheet shows invalid data in column S

**Phase to address:** v2.0 schema planning — must resolve status vocabulary before writing any backend code

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep the `appendRow` array at 17 elements and ignore columns R onward | Minimal change to existing doPost | Token is never written at nomination time; admin page has no tokens to embed in mailto links | Never — token must be in the array |
| Use `appendRow` for referee detail submissions (simpler than row lookup) | Saves the findRowByToken lookup step | Creates duplicate rows; DRA row and referee row are separate orphans | Never — referee submissions must update, not append |
| Store "Late" flag in RefNotes as text | No new column needed | Assignor cannot filter by Late; text matching is fragile | Only if adding a column is genuinely blocked by schema concerns |
| Validate availability client-side only | Faster to build | Bad mobile browser or JS error bypasses validation; blank availability reaches the sheet | Never — server-side availability validation is required |
| Reuse v1.0 status values (Confirmed/Declined) for v2.0 | No schema change needed | "Confirmed" is semantically wrong for "referee submitted their details" | Never — status vocabulary must match the workflow |
| Leave the TEMPLATE_HEADERS array unchanged when simplifying the form | Upload still works for old templates | DRAs who fill out old template believe all fields were saved; they weren't | Never — template must match the current form fields |

---

## Integration Gotchas

Common mistakes when connecting the simplified nomination form and new referee detail form to the existing Apps Script + Sheet.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Simplified nomination form → Apps Script | Sending only 2 fields in the JSON payload and letting doPost handle the mapping | The doPost `appendRow` expects a positional array — send all 18 fields (A–R), using empty strings for referee-provided fields I, J, K, L, M, N, O, P |
| Apps Script doPost → column R token | Generating token separately and writing it in a second `setValues` call after `appendRow` | Include the token in the `appendRow` array at position 17 (0-based) so the row is complete in one atomic operation |
| Referee detail form → Apps Script | Using `appendRow` because it's the pattern already in the codebase | Must use `findRowByToken()` + `sheet.getRange(row, col).setValue()` — referee submissions are row updates, not new rows |
| Column S status write → validation rule | Writing "Completed" when validation only allows "Confirmed" | Update data validation to v2.0 values before any v2.0 backend code touches column S |
| Duplicate email detection | Checking the sheet only for existing email in column H | Also check the current batch payload for duplicates within the same submission — the sheet may not yet have the first occurrence when the second is being processed |
| Deadline check → timezone | Comparing `new Date()` directly against the deadline cell value | Normalize both to the same timezone (CDT) or compare date-only (year/month/day) to avoid midnight boundary issues |

---

## Performance Traps

At 50–100 referees, performance is not a concern. These are only relevant if the system grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Token lookup via per-row `getValue()` in a loop | doGet takes 5–10 seconds to respond | Use batch `getValues()` for the entire token column, search in JavaScript | At 500+ rows |
| Writing referee detail fields one at a time with separate `setValue()` calls | doPost is noticeably slow | Write all referee fields in one `setValues()` call with a range spanning all target columns | At 200+ rows (latency adds up even for single-row writes) |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Token embedded in the DRA confirmation email to the referee | DRA forwards email; third party gets the referee's detail link | The token link goes to the referee's email only — the DRA never sees the token link; DRAs see a general "nomination submitted" confirmation |
| Referee email address stored in the token URL itself (e.g., `?email=jane@example.com&token=...`) | Email visible in browser history, server logs, and link sharing | Token is the only identifier — never include PII in the URL |
| doPost for referee details accepts submissions without token validation | Anyone can POST arbitrary data to the endpoint and pollute the sheet | Every referee detail submission must be rejected if the token doesn't match an existing row |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Referee form shows all fields immediately without pre-filling name | Referee doesn't know which record they're editing; may think it's a fresh form | Pre-fill the referee's name (from the sheet) at the top of the form so they can verify this is their record |
| Form shows "Submit" with no indication this is an edit (for returning visitors) | Referee who filled out the form earlier doesn't know if re-submitting overwrites their previous response | Show "Update Your Details" and display their previously submitted data pre-filled in the form |
| Late submission notice shown before the form | Referee reads "LATE" and closes the page without submitting | Show the late notice AFTER successful submission, or as a banner that doesn't block the form |
| Status remains "Pending" after referee submits | Assignor checks the sheet and calls referee asking if they responded; referee already did | Status must change from "Pending" to "Completed" (or equivalent) atomically with the detail write |
| No confirmation that email was sent after DRA nominates | DRA wonders if their nomination worked; no indication an email will be sent to the referee | DRA confirmation screen should include a note about the next steps (referee will receive an email, etc.) — even though the email is manually triggered |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces in the v2.0 context.

- [ ] **Simplified nomination form:** Verify the SheetJS upload library is either removed or its template matches the new 2-field form — verify by attempting an upload with the old 13-column template
- [ ] **Token at nomination time:** Verify token is written to column R during `doPost` by checking a newly submitted row — not just that the column exists
- [ ] **Row update vs append:** Verify referee detail submission updates row count stays constant — submit details and confirm `sheet.getLastRow()` returns the same value before and after
- [ ] **Status validation:** Verify column S accepts "Completed" (or whatever v2.0 value is chosen) — write the value via Apps Script and confirm no warning triangle appears in the cell
- [ ] **Deadline timezone:** Verify the late flag triggers at the correct local time — submit after midnight UTC but before midnight CDT and confirm the flag is NOT set
- [ ] **Duplicate email within batch:** Verify same email appearing twice in one DRA submission creates only one row — submit a batch with two identical referee emails and check row count
- [ ] **Blank availability blocked:** Verify the Apps Script rejects a detail submission with no weekend selected — POST a payload with empty RefWeekend1 and RefWeekend2 and confirm the error response

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| appendRow-based duplicates in sheet | MEDIUM | Manually delete duplicate rows in the sheet; re-send the token email to affected referees; no code fix needed (the Apps Script update prevents future occurrences) |
| Token missing from column R after nominations | LOW | Run a one-time script to generate and write tokens for rows with blank column R — the same pattern as Phase 2 token generation |
| Wrong status values written to column S (validation mismatch) | LOW | Update the data validation rule to accept the written values; update the Apps Script to write the correct values going forward; no data loss |
| Blank availability submissions marked "Completed" | HIGH | Requires assignor to manually contact each affected referee to re-submit; add server-side validation to prevent future occurrences; mark affected rows in the sheet for follow-up |
| Old TEMPLATE_HEADERS upload silently dropping fields | LOW | DRAs are still within the nomination window — notify them to re-submit using the updated template; their old nominations are in the sheet but missing referee-provided fields |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Blank columns from DRA submission causing confusion or misalignment | Schema planning (before nomination form changes) | Submit a test nomination via simplified form; confirm all 17 columns A-Q have correct values (empty strings, not missing) in the row |
| Upload template mismatch | Nomination form simplification phase | Download template, upload it back — verify only name + email fields are populated, no silent drops |
| Two-writer conflict (append vs update) | Referee detail form Apps Script backend | Submit referee details, confirm row count stays the same, confirm DRA-written columns (A-H) are untouched |
| Re-nomination duplicate within a batch | Nomination form Apps Script backend | Submit a batch with duplicate email; confirm one row created, not two |
| Token not written at nomination time | Nomination form Apps Script backend | Submit nomination; immediately check column R of the new row — must contain a UUID |
| Blank required fields in referee detail form | Referee detail form (client + server) | POST a detail submission with empty availability; confirm error response, no row write, status unchanged |
| Deadline timezone mismatch | Referee detail form Apps Script backend | Test with a submission at midnight boundary |
| Status dropdown rejecting v2.0 values | v2.0 schema planning (before any backend work) | Write "Completed" via Apps Script; check cell for validation warning triangle |

---

## Sources

- Direct inspection of `spring-state-cup-nomination.html` — confirmed `TEMPLATE_HEADERS` array (13 columns), `appendRow` structure (17 fields), `doPost` payload shape, and upload feature coupling
- Direct inspection of `scripts/setup-confirmation-columns.gs` — confirmed v1.0 status values in `requireValueInList()`, confirmed column indices R=18, S=19 (1-based)
- `.planning/research/ARCHITECTURE.md` — confirmed existing data flow, `appendRow` isolation behavior
- `.planning/phases/01-sheet-schema/01-01-SUMMARY.md` — confirmed Phase 1 decisions and what is already in production (ConfirmationDeadline named range at Z1, conditional formatting on column S, four-value dropdown)
- `PROJECT.md` — confirmed v2.0 decisions: token reuse for re-nominations, late submissions with flag, referee edits until deadline, mailto links via Outlook
- Apps Script platform knowledge (cutoff August 2025) — `appendRow` positional behavior, `setValues` vs `setValue`, data validation write behavior (silent warning, not exception)

---

*Pitfalls research for: v2.0 referee detail collection workflow*
*Researched: 2026-03-19*
