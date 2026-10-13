# State Cup Referee Nominations

Referee nomination and detail collection system for the Tennessee State Cup tournament. DRAs nominate referees (name + email), the assignor sends personalized emails via Outlook, and referees fill out their own availability/details through a token-secured form. The Google Sheet is the source of truth for game assignments.

**Live site:** https://615jess.github.io/statecup-refnoms/

## How It Works

1. **DRA nominates** — Submits referee name + email via `state-cup-nomination.html` → row created in sheet with unique token
2. **Assignor sends emails** — Opens `admin.html` (password), clicks Send → formatted email copied to clipboard, Outlook opens addressed → paste and send
3. **Referee provides details** — Opens token link → `referee-details.html` → fills out availability, age, gender, phone, hotel, notes (or declines)
4. **DRA checks nominations** — `dra-nominees.html`, looked up by DRA email
5. **Assignor reviews** — All referee-provided data appears in the Google Sheet

## Architecture

```
GitHub Pages (static HTML)          Google Apps Script (backend)
─────────────────────────           ────────────────────────────
state-cup-nomination.html    nominatev2.gs    — doPost routing
referee-details.html                refdetails.gs    — doGet routing + referee endpoints
admin.html                          adminemail.gs    — admin + DRA endpoints
dra-nominees.html                   setup-schema-v2.gs  — one-time sheet setup
index.html (redirects to nom form)
                                    verify-schema-v2.gs — schema verification
```

- **Frontend:** Static HTML/CSS/JS on GitHub Pages. No build tools, no frameworks. Single-file pages with inline styles and scripts.
- **Backend:** Google Apps Script web app. All server logic lives here.
- **Data:** Google Sheets. 28 columns (A-AB). See `COLUMN-MAP.md` in `.planning/` for the full reference.
- **Email:** Mailto links that open Outlook (Microsoft 365). Not MailApp/GmailApp.

## Files

| File | Purpose |
|------|---------|
| `state-cup-nomination.html` | DRA nomination form (individual + spreadsheet upload) |
| `referee-details.html` | Referee detail form (token-secured, mobile responsive) |
| `admin.html` | Assignor email admin page (password-protected; nominee table, Outlook emails, status tracking) |
| `dra-nominees.html` | DRA lookup of their own nominations by email (names, age groups, notes) |
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
4. Create five script files and paste in the contents of:
   - `scripts/setup-schema-v2.gs`
   - `scripts/verify-schema-v2.gs`
   - `scripts/nominatev2.gs`
   - `scripts/refdetails.gs`
   - `scripts/adminemail.gs`
5. Select **`setupSchemaV2`** from the function dropdown and click Run
   - Authorize when prompted
   - Check Execution Log for "setupSchemaV2 COMPLETE"
6. Go back to the sheet and verify row 1 has headers A through AB
7. Enter the tournament response deadline date in cell **Z1** (the ConfirmationDeadline named range)
8. Optionally run **`verifySchemaV2`** to confirm everything is correct

### 2. Update Tournament Constants

1. In the Apps Script editor, open `nominatev2.gs`
2. Find the `setTournamentConstants()` function (near the bottom)
3. Update these values for the new tournament:
   - `ASSIGNOR_EMAIL` — the assignor's Outlook email
   - `WEEKEND_1_DATES` — display string like `'November 14 & 15, 2026'`
   - `WEEKEND_2_DATES` — display string like `'November 21 & 22, 2026'`
   - `REF_FORM_URL` — the GitHub Pages URL for `referee-details.html`
4. Select **`setTournamentConstants`** from the function dropdown and click Run
5. Verify in **Project Settings > Script Properties** that all four values are saved
6. In **Project Settings > Script Properties**, add `ADMIN_KEY` by hand with a password of your choice. The admin page asks for it. Never put it in code — this repo is public. If it's missing, the admin page can't load.

### 3. Deploy the Apps Script Web App

1. Click **Deploy > New deployment**
2. Select type: **Web app**
3. Settings:
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy** and copy the `/exec` URL

**Important:** Every time you change Apps Script code, publish it with **Deploy > Manage deployments > Edit > Version: New version**. This keeps the same `/exec` URL, so the HTML pages don't need updating. (Deploy > New deployment creates a new URL instead.)

**Admin password:** set an `ADMIN_KEY` Script Property by hand (Project Settings > Script Properties). The admin page asks for it. Never put it in code — this repo is public.

### 4. Update the HTML Files with the Deployment URL

Only needed if you made a **new** deployment (a new `/exec` URL). Editing the existing deployment with a new version keeps the URL, so you can skip this.

All four pages hold the Apps Script URL:

- `state-cup-nomination.html` — `const SHEET_URL = "..."`
- `referee-details.html` — `const SCRIPT_URL = '...'`
- `admin.html` — `var SCRIPT_URL = '...'`
- `dra-nominees.html` — `var SCRIPT_URL = '...'`

### 5. Update Season-Specific Text

Weekend dates in emails and on the referee form come from the Script Properties, and the response deadline comes from cell Z1. Everything below is typed into the pages and must be changed by hand each season (search for the old year/dates):

**All four pages**
- `<title>` and the red "Fall State Cup 2026" pill in the header
- Weekend dates in the dark date bar under the header

**`state-cup-nomination.html`**
- DRA names, emails and districts in the DRA dropdown
- "Fall State Cup is Boys U15–U19 only" callout (age groups and cup names)
- Nomination deadline callout ("hard deadline is Thursday, October 29, 2026")
- `const AGES = [...]` — age groups offered in the dropdowns

**`referee-details.html`**
- Greeting text: "…nominated you for the Fall State Cup 2026 referee pool"

**`admin.html`** (the nominee email and reminder email)
- `EMAIL_SUBJECT` and `NOMINEE_CC` (SRA/SYRA addresses)
- "Congratulations… Fall State Cup 2026" opening line (formatted and plain-text versions)
- Mandatory referee meeting date ("Friday, November 13") — appears twice
- "post assignments for the first weekend on November 6" — appears twice
- "Fall State Cup 2026" in the email's navy header
- Reminder email subject and text
- Assignor name and signature ("Jess Erickson")

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
4. Click **Send Email**, paste into Outlook (⌘V), then click **Sent — Next Referee** — status should change to "Sent"
5. Open the referee detail link from the email
6. Fill out and submit the referee detail form
7. Check the sheet — referee-provided columns should be filled and status should be "Confirmed" (or "Declined" if No for both weekends)
8. Open `dra-nominees.html`, enter the DRA's email — the test referee should be listed
9. Delete the test row from the sheet

## Running the Process (Fall State Cup 2026)

| Date | What happens |
|------|--------------|
| Now – Oct 29 | DRAs submit nominations (hard deadline **Thursday, October 29**) |
| As nominations arrive | Assignor sends nominee emails from the admin page |
| Deadline in cell Z1 | Referees respond; late responses accepted for 3 more days, then the form closes |
| Nov 6 | Weekend 1 assignments posted |
| Fri Nov 13 | Mandatory referee meeting at the referee hotel |
| Nov 14–15 / Nov 21–22 | Weekend 1 / Weekend 2 (Championship Weekend) |

**DRAs**
- Nominate at https://615jess.github.io/statecup-refnoms/ (one at a time, or upload the spreadsheet template)
- Review what they've submitted at `dra-nominees.html` by entering their DRA email (shows names, age groups and notes only)

**Assignor — sending nominee emails** (`admin.html`)
1. Open the admin page and enter the admin password (asked once per browser).
2. Click **Send Email** on a referee. The formatted email is copied to your clipboard and Outlook opens with To, CC and Subject filled in — **the body is blank on purpose.**
3. Click in the Outlook message body and press **⌘V** to paste the email. Check the name and address, then send.
4. Back on the admin page, click **Sent — Next Referee** (or **Didn't Send** if you closed it). Only "Sent" changes the status.
5. **Plain** is the backup: a plain-text email in the link itself, no paste needed.
6. **Re-send** appears on rows already marked Sent.
7. The reminder section near the bottom builds one BCC email to everyone still at "Sent" (no response yet).

**Statuses**
- **Not Sent** — nominated, email not sent yet
- **Sent** — email sent, waiting on the referee
- **Confirmed** — referee responded and is available at least one weekend
- **Declined** — referee responded "No" for both weekends

## Sheet Column Layout (A-AB)

| Col | Header | Written By |
|-----|--------|------------|
| A | Timestamp | System (nominateV2) |
| B | DRA Name | DRA form |
| C | DRA Email | DRA form (auto-filled from DRA dropdown) |
| D | District | DRA form |
| E | Referee # | DRA form |
| F | First Name | DRA form |
| G | Last Name | DRA form |
| H | Referee Email | DRA form |
| I | Phone | Referee form |
| J | Age | Referee form |
| K | Max Age as AR | DRA form |
| L | Max Age as Ref | DRA form |
| M | Availability | Referee form (summary, e.g. "Yes / No") |
| N | Gender | Referee form |
| O | Hotel Weekend 1 | Referee form |
| P | Hotel Weekend 2 | Referee form |
| Q | DRA Notes | DRA form |
| R | Token | System (UUID at nomination) |
| S | Status | System (Not Sent → Sent → Confirmed / Declined) |
| T | SentAt | System (markSent) |
| U | SubmittedAt | System (submitDetails) |
| V | RefWeekend1 | Referee form |
| W | RefWeekend2 | Referee form |
| X | LateFlag | System (Y if first submitted after deadline) |
| Y | RefNotes | Referee form |
| Z | ConfirmationDeadline | Assignor (named range, Z1 only) |
| AA | (label) | "Confirmation Deadline:" label in AA1 |
| AB | Parent/Guardian Email | Referee form (under 18 only) |

## Status Flow

```
Not Sent  →  Sent  →  Confirmed   (available at least one weekend)
   ↑           ↑    ↘  Declined    (not available either weekend)
nomination  assignor   referee
created     confirms   submits
            email sent details
```

## Key Behaviors

- **Email dedup:** If a DRA nominates the same email twice, the existing row is updated (DRA fields only). Token and referee data are preserved.
- **Late submissions:** After the deadline date in Z1, referees can still submit but get a late banner and LateFlag=Y in the sheet. After deadline + 3 days (hard close), the form locks completely.
- **Re-edits:** Referees can revisit their token link and update their details until the hard close (deadline + 3 days). Previously submitted data is pre-filled. Edits after the deadline keep the original on-time/late flag.
- **markSent:** The referee is marked "Sent" only after the assignor clicks "Sent — Next Referee" on the admin page. A status that is already Sent, Confirmed or Declined is never overwritten. Sent rows get a Re-send button.
- **Admin password:** `getAllNominees` and `markSent` require the `ADMIN_KEY` Script Property. The admin page asks for it once per browser.
- **DRA view:** `dra-nominees.html` looks up nominations by the DRA's email (column C) and shows only referee name, max age groups and DRA notes.
