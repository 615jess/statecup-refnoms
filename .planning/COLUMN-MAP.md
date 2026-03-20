# Column Map — State Cup Referee Nomination System v2.0

**Status:** Authoritative — single source of truth for all phases
**Created:** Phase 1 (Schema Setup), Plan 01-01
**Last updated:** 2026-03-19

This document defines every column A-Z in the nomination Google Sheet for v2.0. All downstream phases (2, 3, 4) and their code must reference this document. Any discrepancy between this document and `scripts/setup-schema-v2.gs` is a bug.

---

## Column Map A-Z

| Col | 1-based | 0-based | Header | Writer | Phase |
|-----|---------|---------|--------|--------|-------|
| A | 1 | 0 | Timestamp | System (nominateV2) | Phase 2 |
| B | 2 | 1 | DRA Name | DRA form | Phase 2 |
| C | 3 | 2 | DRA Email | DRA form | Phase 2 |
| D | 4 | 3 | District | DRA form | Phase 2 |
| E | 5 | 4 | Referee # | DRA form | Phase 2 |
| F | 6 | 5 | First Name | DRA form | Phase 2 |
| G | 7 | 6 | Last Name | DRA form | Phase 2 |
| H | 8 | 7 | Referee Email | DRA form | Phase 2 |
| I | 9 | 8 | Phone | Referee form | Phase 3 |
| J | 10 | 9 | Age | Referee form | Phase 3 |
| K | 11 | 10 | Max Age as AR | DRA form | Phase 2 |
| L | 12 | 11 | Max Age as Ref | DRA form | Phase 2 |
| M | 13 | 12 | Availability | Referee form | Phase 3 |
| N | 14 | 13 | Gender | Referee form | Phase 3 |
| O | 15 | 14 | Hotel Weekend 1 | Referee form | Phase 3 |
| P | 16 | 15 | Hotel Weekend 2 | Referee form | Phase 3 |
| Q | 17 | 16 | DRA Notes | DRA form | Phase 2 |
| R | 18 | 17 | Token | System (nominateV2) | Phase 2 |
| S | 19 | 18 | Status | System | Phase 1 (validation) |
| T | 20 | 19 | SentAt | System (Phase 4 TBD) | Phase 4 |
| U | 21 | 20 | SubmittedAt | System (submitDetails) | Phase 3 |
| V | 22 | 21 | RefWeekend1 | Referee form | Phase 3 |
| W | 23 | 22 | RefWeekend2 | Referee form | Phase 3 |
| X | 24 | 23 | LateFlag | System (submitDetails) | Phase 3 |
| Y | 25 | 24 | RefNotes | Referee form | Phase 3 |
| Z | 26 | 25 | *(blank — date value cell)* | Assignor | Phase 1 (named range) |

**Column Z note:** Z1 is blank in the header row. It holds the confirmation deadline date entered directly by the assignor. It is the target of the `ConfirmationDeadline` named range. Column AA1 contains the label `"Confirmation Deadline:"` to indicate its purpose.

---

## Named Ranges

| Name | Cell | Type | Writer | Purpose |
|------|------|------|--------|---------|
| ConfirmationDeadline | Z1 | Date | Assignor (manual entry) | Stores the tournament submission deadline; all phases read this to determine late flags |

**How to read in code (all phases):**

```javascript
var ss = SpreadsheetApp.getActiveSpreadsheet();
var deadlineRange = ss.getRangeByName('ConfirmationDeadline');
if (!deadlineRange) {
  throw new Error('ConfirmationDeadline named range not found. Run Phase 1 setup.');
}
var deadline = deadlineRange.getValue(); // returns a Date object if Z1 contains a date
```

---

## Status Values (Column S)

Column S uses a dropdown with exactly 3 values. Invalid values are rejected (not just warned).

| Value | Meaning | Background | Font Color |
|-------|---------|------------|------------|
| Not Sent | Nomination recorded; confirmation email not yet sent | #e8eaed (gray) | #3c4043 (dark gray) |
| Sent | Confirmation email sent to referee | #fef9c3 (yellow) | #854d0e (dark yellow) |
| Confirmed | Referee submitted their details | #dcfce7 (green) | #166534 (dark green) |

---

## Column Index Constants (Apps Script — 1-based)

Use these named constants in all Apps Script code. Never use bare number literals for column references.

```javascript
var COL_TIMESTAMP    =  1; // A
var COL_DRA_NAME     =  2; // B
var COL_DRA_EMAIL    =  3; // C
var COL_DISTRICT     =  4; // D
var COL_REF_NUMBER   =  5; // E
var COL_FIRST_NAME   =  6; // F
var COL_LAST_NAME    =  7; // G
var COL_REF_EMAIL    =  8; // H
var COL_PHONE        =  9; // I
var COL_AGE          = 10; // J
var COL_MAX_AGE_AR   = 11; // K
var COL_MAX_AGE_REF  = 12; // L
var COL_AVAILABILITY = 13; // M
var COL_GENDER       = 14; // N
var COL_HOTEL_WKD1   = 15; // O
var COL_HOTEL_WKD2   = 16; // P
var COL_DRA_NOTES    = 17; // Q
var COL_TOKEN        = 18; // R
var COL_STATUS       = 19; // S
var COL_SENT_AT      = 20; // T
var COL_SUBMITTED_AT = 21; // U
var COL_REF_WEEKEND1 = 22; // V
var COL_REF_WEEKEND2 = 23; // W
var COL_LATE_FLAG    = 24; // X
var COL_REF_NOTES    = 25; // Y
var COL_DEADLINE     = 26; // Z — named range target
var COL_LABEL        = 27; // AA — "Confirmation Deadline:" label
```

**0-based array index** (subtract 1 from 1-based): use when indexing into `getValues()` results.

---

## v1.0 to v2.0 Column Changes

| Column | v1.0 Header | v2.0 Header | Change Type |
|--------|-------------|-------------|-------------|
| N | Hotel — Weekend 1 | Gender | Header rename + writer change (DRA → Referee) + semantic change |
| O | Hotel — Weekend 2 | Hotel Weekend 1 | Header rename + writer change (DRA → Referee) + position shift |
| P | Day-Specific Notes | Hotel Weekend 2 | Header rename + writer change (DRA → Referee) + position shift |
| U | ConfirmedAt | SubmittedAt | Header rename only |
| X | RefHotel | LateFlag | Header rename + writer change (DRA → System) + semantic change |

**Writer changes (columns I-P):** In v1.0, columns I-P were written by the DRA form. In v2.0, columns I-P are written by the referee form. Column positions are unchanged — only the writer and (for several columns) the meaning changed.

**Status values:** v1.0 had 4 values (Not Sent / Pending / Confirmed / Declined). v2.0 has exactly 3 (Not Sent / Sent / Confirmed). The old "Pending" and "Declined" values are not valid in v2.0.

**Safe because:** The sheet was cleared as part of Phase 1 setup — no v1.0 data persists. All column semantic changes are handled by the clean-slate approach.

---

## Column Writer Summary

| Writer | Columns | Trigger |
|--------|---------|---------|
| DRA form (Google Form) | A, B, C, D, E, F, G, H, K, L, Q | Form submission via `doPost` nominateV2 |
| System (`nominateV2`) | A (Timestamp), R (Token), S (initial "Not Sent") | Same `doPost` handler |
| Referee form (web form) | I, J, M, N, O, P, V, W, Y | `submitDetails` endpoint |
| System (`submitDetails`) | U (SubmittedAt), X (LateFlag) | Same submission handler |
| System (Phase 4 TBD) | T (SentAt) | Admin page action — exact mechanism TBD |
| Assignor (manual) | Z (deadline date) | Direct cell entry in Google Sheet |

---

## Open Question: Column T (SentAt)

Column T (`SentAt`) writer is marked "Phase 4 TBD" above. The confirmation email system (Phase 4) will determine exactly when and how T is written. Options include:

- Auto-write when admin page generates the mailto link (client-side timestamp)
- Write via a separate Apps Script function the assignor triggers
- Leave empty and use Status="Sent" as the proxy

This must be resolved before Phase 4 planning.

---

*Phase: 01-schema-setup | Plan: 01-01*
*Source of truth for: scripts/setup-schema-v2.gs, scripts/verify-schema-v2.gs, and all Phase 2-4 scripts*
