# State Cup Referee Nominations

Referee nomination and detail collection system for the Tennessee State Cup tournament. DRAs nominate referees (name + email), the assignor sends personalized emails via Outlook, and referees fill out their own availability/details through a token-secured form. The Google Sheet is the source of truth for game assignments.

**Live site:** https://615jess.github.io/statecup-refnoms/

## How It Works

1. **DRA nominates** — Submits referee name + email via `spring-state-cup-nomination.html` → row created in sheet with unique token
2. **Assignor sends emails** — Opens `admin.html`, clicks mailto links → Outlook opens with pre-filled email containing the referee's token link
3. **Referee provides details** — Opens token link → `referee-details.html` → fills out availability, age, gender, phone, hotel, notes
4. **Assignor reviews** — All referee-provided data appears in the Google Sheet

## Architecture

```
GitHub Pages (static HTML)          Google Apps Script (backend)
─────────────────────────           ────────────────────────────
spring-state-cup-nomination.html    nominatev2.gs    — doPost routing
referee-details.html                refdetails.gs    — doGet routing + referee endpoints
admin.html                          adminemail.gs    — admin endpoints
index.html (redirects to nom form)  setup-schema-v2.gs  — one-time sheet setup
                                    verify-schema-v2.gs — schema verification
```

- **Frontend:** Static HTML/CSS/JS on GitHub Pages. No build tools, no frameworks. Single-file pages with inline styles and scripts.
- **Backend:** Google Apps Script web app. All server logic lives here.
- **Data:** Google Sheets. 26 columns (A-Z). See `COLUMN-MAP.md` in `.planning/` for the full reference.
- **Email:** Mailto links that open Outlook (Microsoft 365). Not MailApp/GmailApp.

## Files

| File | Purpose |
|------|---------|
| `spring-state-cup-nomination.html` | DRA nomination form (individual + spreadsheet upload) |
| `referee-details.html` | Referee detail form (token-secured, mobile responsive) |
| `admin.html` | Assignor email admin page (nominee table, mailto links, status tracking) |
| `index.html` | Redirect to nomination form |
| `scripts/nominatev2.gs` | doPost entry point — routes nominateV2, submitDetails, markSent |
| `scripts/refdetails.gs` | doGet entry point — routes getAllNominees and token-based detail lookups |
| `scripts/adminemail.gs` | getAllNominees + markSent handlers |
| `scripts/setup-schema-v2.gs` | One-time schema setup (headers, validation, named ranges, formatting) |
| `scripts/verify-schema-v2.gs` | Verification suite to confirm schema is correct |

## Setup for a New Tournament

You need to do this each season. The system has three pieces: the Google Sheet, the Apps Script backend, and the GitHub Pages site.

### 1. Set Up the Google Sheet

1. Create a new Google Sheet (or copy last season's and clear the data rows)
2. Open **Extensions > Apps Script**
3. Delete all existing script files
4. Create four script files and paste in the contents of:
   - `scripts/setup-schema-v2.gs`
   - `scripts/verify-schema-v2.gs`
   - `scripts/nominatev2.gs`
   - `scripts/refdetails.gs`
   - `scripts/adminemail.gs`
5. Select **`setupSchemaV2`** from the function dropdown and click Run
   - Authorize when prompted
   - Check Execution Log for "setupSchemaV2 COMPLETE"
6. Go back to the sheet and verify row 1 has headers A through Y
7. Enter the tournament response deadline date in cell **Z1** (the ConfirmationDeadline named range)
8. Optionally run **`verifySchemaV2`** to confirm everything is correct

### 2. Update Tournament Constants

1. In the Apps Script editor, open `nominatev2.gs`
2. Find the `setTournamentConstants()` function (near the bottom)
3. Update these values for the new tournament:
   - `ASSIGNOR_EMAIL` — the assignor's Outlook email
   - `WEEKEND_1_DATES` — display string like `'May 16 & 17, 2026'`
   - `WEEKEND_2_DATES` — display string like `'May 23 & 24, 2026'`
   - `REF_FORM_URL` — the GitHub Pages URL for `referee-details.html`
4. Select **`setTournamentConstants`** from the function dropdown and click Run
5. Verify in **Project Settings > Script Properties** that all four values are saved

### 3. Deploy the Apps Script Web App

1. Click **Deploy > New deployment**
2. Select type: **Web app**
3. Settings:
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy** and copy the `/exec` URL

**Important:** Every time you change Apps Script code, you must create a **new deployment** (Deploy > New deployment). You cannot update an existing deployment in-place.

### 4. Update the HTML Files with the New Deployment URL

All three HTML pages need the Apps Script URL. Search and replace the old URL in each file:

- `spring-state-cup-nomination.html` — look for `const SHEET_URL = "..."`
- `referee-details.html` — look for `const SCRIPT_URL = '...'`
- `admin.html` — look for `var SCRIPT_URL = '...'`

Replace with the new `/exec` URL from step 3.

### 5. Update Season-Specific Text

In each HTML file, update any hardcoded tournament details:
- Tournament name/year in `<title>` and headers (e.g., "Spring State Cup 2026")
- Weekend dates displayed in the UI
- DRA names/emails in the nomination form dropdown (in `spring-state-cup-nomination.html`)

### 6. Push to GitHub Pages

```bash
git add -A
git commit -m "Update for [Season] [Year] tournament"
git push origin main
```

GitHub Pages will deploy automatically from the `main` branch. The site is at:
https://615jess.github.io/statecup-refnoms/

### 7. Test End-to-End

1. Open the nomination form and submit a test referee
2. Check the Google Sheet — a row should appear with a token in column R
3. Open `admin.html` — the test referee should appear in the table
4. Click the mailto link — Outlook should open with a pre-filled email
5. Copy the referee detail link from the email body and open it
6. Fill out and submit the referee detail form
7. Check the sheet — referee-provided columns should be filled and status should be "Confirmed"

## Sheet Column Layout (A-Z)

| Col | Header | Written By |
|-----|--------|------------|
| A | Timestamp | System (nominateV2) |
| B | DRA Name | DRA form |
| C | DRA Email | DRA form |
| D | District | DRA form |
| E | Referee # | DRA form |
| F | First Name | DRA form |
| G | Last Name | DRA form |
| H | Referee Email | DRA form |
| I | Phone | Referee form |
| J | Age | Referee form |
| K | Max Age as AR | DRA form |
| L | Max Age as Ref | DRA form |
| M | Availability | Referee form |
| N | Hotel — Weekend 1 | Referee form |
| O | Hotel — Weekend 2 | Referee form |
| P | Day-Specific Notes | Referee form |
| Q | DRA Notes | DRA form |
| R | Token | System (UUID at nomination) |
| S | Status | System (Not Sent → Sent → Confirmed) |
| T | SentAt | System (markSent) |
| U | SubmittedAt | System (submitDetails) |
| V | RefWeekend1 | Referee form |
| W | RefWeekend2 | Referee form |
| X | LateFlag | System (Y if submitted after deadline) |
| Y | RefNotes | Referee form |
| Z | ConfirmationDeadline | Assignor (named range, one cell) |

## Status Flow

```
Not Sent  →  Sent  →  Confirmed
   ↑           ↑          ↑
nomination  assignor   referee
created     clicks     submits
            mailto     details
```

## Key Behaviors

- **Email dedup:** If a DRA nominates the same email twice, the existing row is updated (DRA fields only). Token and referee data are preserved.
- **Late submissions:** After the deadline date in Z1, referees can still submit but get a late banner and LateFlag=Y in the sheet. After deadline + 3 days (hard close), the form locks completely.
- **Re-edits:** Referees can revisit their token link and update their details until the deadline. Previously submitted data is pre-filled.
- **markSent idempotency:** Clicking a mailto link marks the referee as "Sent" via an API call. If the referee is already "Confirmed", the status is not overwritten back to "Sent".
