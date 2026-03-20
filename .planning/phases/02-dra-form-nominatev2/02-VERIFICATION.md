---
phase: 02-dra-form-nominatev2
verified: 2026-03-20T04:48:47Z
status: passed
score: 5/5 must-haves verified
---

# Phase 2: DRA Form + nominateV2 Verification Report

**Phase Goal:** A DRA can submit referee nominations (individually or via spreadsheet upload) and each nomination creates exactly one sheet row with a token, leaving referee-detail columns blank — ready for the referee to fill
**Verified:** 2026-03-20T04:48:47Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | DRA submits nomination — single row appears with A-H, K-L, Q filled; I, J, M-P blank; R has UUID; S = "Not Sent" | VERIFIED | `_appendNewRow` builds exact 19-element array: indices 8,9 blank (I,J); 10,11 = max_ar/max_ref (K,L); 12-15 blank (M-P); 16 = notes (Q); 17 = token (R); 18 = "Not Sent" (S) |
| 2 | Token (UUID) in column R immediately after nomination; I, J, M-P blank | VERIFIED | `Utilities.getUuid()` called before `_appendNewRow`; token passed as parameter and written to index 17 (R); blank strings at indices 8,9,12-15 |
| 3 | Re-nominating same email updates DRA fields only; no duplicate; I-P, R, S unchanged | VERIFIED | `_updateDraColumns` writes only A-H (8-col range), K-L (2-col range), Q (single setValue); never touches I,J,M-P,R,S; `_loadEmailIndex` + loop prevents duplicate append |
| 4 | Spreadsheet upload creates one row per referee; no duplicates even if same email appears twice | VERIFIED | `_deduplicateBatch` runs last-wins deduplification before `_loadEmailIndex` lookup; HTML upload handler uses append mode (handleUpload never clears ref-list) |
| 5 | Tournament constants stored in PropertiesService | VERIFIED | `setTournamentConstants()` calls `PropertiesService.getScriptProperties().setProperties(...)` with ASSIGNOR_EMAIL, WEEKEND_1_DATES, WEEKEND_2_DATES, REF_FORM_URL |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/nominatev2.gs` | doPost handler with nominateV2 action, email dedup, token gen, LockService, PropertiesService setup | VERIFIED | 430 lines, ES5 only (no const/let/arrow functions confirmed by grep — only comment hits for "const"), all named functions present |
| `spring-state-cup-nomination.html` | v2.0 DRA form with 6-field cards, append-mode upload, nominateV2 payload | VERIFIED | 604 lines, SHEET_URL points to live /exec endpoint, action:'nominateV2' at line 400 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `spring-state-cup-nomination.html` fetch | Apps Script /exec URL | `fetch(SHEET_URL, { method: 'POST', body: JSON.stringify(payload) })` | WIRED | SHEET_URL = `AKfycbyK7iYFG7d...exec`; payload includes `action: 'nominateV2'` and `rows` array |
| `spring-state-cup-nomination.html` summary | `data.results` array | `results.forEach` with `r.status === 'new'` / `'updated'` badge branches | WIRED | Lines 414-419; green badge for new, muted badge for updated; uses `esc()` XSS helper |
| `spring-state-cup-nomination.html` upload | SheetJS XLSX library | `XLSX.read()` and `XLSX.utils.sheet_to_json()` | WIRED | Lines 470, 472; CDN loaded with SRI hash at line 8 |
| `nominatev2.gs _loadEmailIndex` | Column H (Referee Email) | `sheet.getRange(2, COL_REF_EMAIL, dataRowCount, 1)` | WIRED | COL_REF_EMAIL = 8; reads rows 2-lastRow into email→rowNumber map |
| `nominatev2.gs _appendNewRow` | Column R (Token) | `Utilities.getUuid()` → array index 17 | WIRED | Token generated in `_handleNominateV2`, passed to `_appendNewRow(sheet, row, token)`, written at index 17 |
| `nominatev2.gs _updateDraColumns` | Columns A-H, K-L, Q only | Three separate `getRange().setValues/setValue()` calls | WIRED | Range 1: `getRange(rowNum,1,1,8)` for A-H; Range 2: `getRange(rowNum,11,1,2)` for K-L; Range 3: `getRange(rowNum,17).setValue()` for Q |

---

### Column Map Compliance

| Column | COLUMN-MAP.md says | nominatev2.gs constant | Match |
|--------|--------------------|------------------------|-------|
| A (1) | Timestamp | COL_TIMESTAMP = 1 | YES |
| B (2) | DRA Name | COL_DRA_NAME = 2 | YES |
| C (3) | DRA Email | COL_DRA_EMAIL = 3 | YES |
| D (4) | District | COL_DISTRICT = 4 | YES |
| E (5) | Referee # | COL_REF_NUMBER = 5 | YES |
| F (6) | First Name | COL_FIRST_NAME = 6 | YES |
| G (7) | Last Name | COL_LAST_NAME = 7 | YES |
| H (8) | Referee Email | COL_REF_EMAIL = 8 | YES |
| K (11) | Max Age as AR | COL_MAX_AGE_AR = 11 | YES |
| L (12) | Max Age as Ref | COL_MAX_AGE_REF = 12 | YES |
| Q (17) | DRA Notes | COL_DRA_NOTES = 17 | YES |
| R (18) | Token | COL_TOKEN = 18 | YES |
| S (19) | Status | COL_STATUS = 19 | YES |

All 13 column constants used by nominatev2.gs match COLUMN-MAP.md exactly.

---

### Phase Success Criteria Coverage

| Criterion | Status | Evidence |
|-----------|--------|----------|
| 1. Row with A-H and Q filled, K-L filled, I-J-M-P blank | SATISFIED | `_appendNewRow` array: indices 0-7 (A-H), 8-9 blank (I-J), 10-11 = max_ar/max_ref (K-L), 12-15 blank (M-P), 16 = notes (Q) |
| 2. Token in column R, I-J-M-P blank | SATISFIED | Index 17 = token; indices 8,9,12-15 = '' |
| 3. Re-nomination updates DRA fields without duplicate, preserves I-P/R/S | SATISFIED | `_updateDraColumns` explicitly writes only A-H, K-L, Q; never touches I,J,M-P,R,S; email index lookup prevents new append |
| 4. Batch upload creates one row per referee, no duplicates | SATISFIED | `_deduplicateBatch` (last-wins); HTML append mode confirmed — `handleUpload` never resets ref-list |
| 5. Tournament constants in PropertiesService | SATISFIED | `setTournamentConstants()` verified present with all 4 keys: ASSIGNOR_EMAIL, WEEKEND_1_DATES, WEEKEND_2_DATES, REF_FORM_URL |

---

### Anti-Patterns Found

None. No TODO/FIXME blockers, no placeholder returns, no stub handlers.

Notable non-blockers:
- Two TODO comments in DRA dropdown for Don Eubank and Mark Herrington placeholder emails (`TODO_eubank@email.com`, `TODO_herrington@email.com`). These are known pre-go-live items documented in 02-02-SUMMARY.md, not blocking for the nomination workflow.
- REF_FORM_URL stored as 'TBD' in PropertiesService — expected; awaits Phase 3 deployment.

---

### Human Verification Required

The following were verified by the DRA (human checkpoint) during Plan 02-01 Task 2 and Plan 02-02 Task 2, as documented in SUMMARY files. No additional human verification is required from this automated pass.

Items previously verified by human:
1. `setTournamentConstants` ran successfully in Apps Script editor — Logger confirmed "Tournament constants saved"
2. Script Properties confirmed present in Project Settings
3. testNominateV2 test produced correct sheet row (A-H + Q filled, I-P blank, R = UUID, S = "Not Sent")
4. Re-nomination of same email returned "updated" with no duplicate row
5. End-to-end form submission via browser (E2E checkpoint in Plan 02-02)

---

## Summary

Phase 2 goal is achieved. Both artifacts are substantive and fully wired:

**`scripts/nominatev2.gs`** (430 lines, ES5): The doPost handler correctly routes the nominateV2 action through LockService-serialized processing. `_deduplicateBatch` handles within-batch dedup. `_loadEmailIndex` reads column H to prevent cross-submission duplicates. `_appendNewRow` builds an exact 19-element array with I, J, M-P blank and K-L filled from DRA input. `_updateDraColumns` makes three targeted writes (A-H range, K-L range, Q single cell) and provably never touches the referee-detail or system columns. `setTournamentConstants` stores all 4 Script Properties.

**`spring-state-cup-nomination.html`** (604 lines): The form collects 6 fields per referee card (first, last, email, max_ar, max_ref, notes), all required except notes. The submit handler POSTs `action:'nominateV2'` with a rows array to the live /exec endpoint. Upload is append-mode (handleUpload never clears ref-list — only clearUpload does). Success summary correctly parses `data.results` and renders per-nominee new/updated badges with XSS escaping. The honeypot field is wired at both ends (form field + backend check).

Column map compliance is 100%: all 13 constants in nominatev2.gs match COLUMN-MAP.md exactly, including the corrected K (11) and L (12) for DRA-provided max-age fields.

---

_Verified: 2026-03-20T04:48:47Z_
_Verifier: Claude (gsd-verifier)_
