# Architecture Research: v2.0 Referee Detail Collection

**Project:** State Cup Referee Nominations — v2.0 (DRA submits name+email; referee provides own details)
**Researched:** 2026-03-19
**Confidence:** HIGH — based on direct inspection of existing codebase and Apps Script platform knowledge

---

## Existing Architecture (What We're Building On)

```
GitHub Pages (static hosting)
  index.html                         — meta-redirect to nomination form
  spring-state-cup-nomination.html   — nomination form (~689 lines, inline CSS/JS)
  logo.webp, TNRefLOGO.png           — brand assets

Google Apps Script Web App (single /exec deployment)
  doPost(e)    — receives JSON from nomination form, validates, appends rows to sheet
  (no doGet)   — currently undefined

Google Sheet ("Spring State Cup 2026 — Referee Nominations")
  Row 1: headers (A–Q = 17 columns, then R–Y = 8 columns added in v1.0 Phase 1)
  Rows 2+: one row per nominated referee
  Z1: ConfirmationDeadline (named range)
  AA1: "Confirmation Deadline:" label

Named range: ConfirmationDeadline → Z1
```

### Existing Sheet Schema (A–Y)

| Col | Header | v1.0 writer | v2.0 status |
|-----|--------|-------------|-------------|
| A | Timestamp | DRA nomination form | Keep — written by doPost on nomination |
| B | DRA Name | DRA nomination form | Keep |
| C | DRA Email | DRA nomination form | Keep |
| D | District | DRA nomination form | Keep |
| E | Referee # | DRA nomination form | Keep |
| F | First Name | DRA nomination form | Keep — DRA still provides name |
| G | Last Name | DRA nomination form | Keep |
| H | Referee Email | DRA nomination form | Keep — DRA still provides email |
| I | Phone | DRA nomination form | **Now empty at nomination time — referee fills** |
| J | Age | DRA nomination form | **Now empty at nomination time — referee fills** |
| K | Max Age as AR | DRA nomination form | **Now empty at nomination time — referee fills** |
| L | Max Age as Referee | DRA nomination form | **Now empty at nomination time — referee fills** |
| M | Availability | DRA nomination form | **Now empty at nomination time — referee fills** |
| N | Hotel Wk1 | DRA nomination form | **Now empty at nomination time — referee fills** |
| O | Hotel Wk2 | DRA nomination form | **Now empty at nomination time — referee fills** |
| P | Day Notes | DRA nomination form | **Now empty at nomination time — referee fills** |
| Q | DRA Notes | DRA nomination form | Keep — DRA still provides notes about nominee |
| R | Token | (setup script) | Keep — unchanged purpose |
| S | Status | (setup script) | Keep — Not Sent / Pending / Completed |
| T | SentAt | (Phase 2+) | Keep — timestamp when assignor sends email |
| U | ConfirmedAt | (Phase 2+) | Keep — timestamp when referee submits |
| V | RefWeekend1 | (Phase 2+) | Keep — Confirmed / Declined |
| W | RefWeekend2 | (Phase 2+) | Keep — Confirmed / Declined |
| X | RefHotel | (Phase 2+) | **Repurpose: replace single hotel field** |
| Y | RefNotes | (Phase 2+) | Keep — referee free-text notes |

---

## Architectural Decision 1: Where Does Referee Detail Data Live?

**The question:** In v2.0, the referee provides phone, age, max AR/ref ages, availability, hotel, and day notes. Should this data overwrite the empty DRA columns (I–P), or go in new columns?

**Option A: Referee writes into existing DRA columns I–P (overwrite blanks)**

The DRA nomination form is simplified to name + email only. Columns I–P are submitted empty (or omitted) at nomination time. The referee detail form then fills those same columns.

```
DRA submits → row created with A-H filled, I-P blank, Q filled, R-Y blank
Referee submits → I-P filled in, V-Y updated
```

Pro: Existing column layout is preserved exactly. No new columns needed.
Pro: The sheet reads as a complete row — the assignor sees the final state without scanning two blocks.
Pro: R-Y block (already built) covers all confirmation-tracking metadata.
Con: The "I-P were blank" state cannot be distinguished from "I-P were cleared maliciously" without checking status column S.
Con: If a referee edits their submission, the old DRA-entered data cannot be recovered — but in v2.0 the DRA never enters I-P at all, so there is nothing to recover.

**Option B: Referee writes into new columns beyond Y (Z+ area)**

The columns I–P remain blank (or carry legacy v1.0 data from old submissions). New columns are added for referee-provided details.

Pro: Preserves separation between DRA and referee data.
Con: Pushes meaningful data far to the right of the sheet, past the ConfirmationDeadline cell at Z1.
Con: Requires another schema migration (more setup scripts, more testing).
Con: ConfirmationDeadline is a named range at Z1 — appending new columns there is messy.

**Option C: Referee writes into V–Y, expanding V–Y's scope**

In v1.0, V–Y were: RefWeekend1, RefWeekend2, RefHotel, RefNotes. In v2.0, these columns expand to cover more referee-provided fields. If V–Y aren't enough columns, add more between Y and Z.

Con: Z1 is the ConfirmationDeadline named range — inserting columns before Z would shift it.
Con: V–Y currently have specific headers that don't match all referee detail fields.

**Recommendation: Option A — referee writes into I–P**

Rationale:
- In v2.0, the DRA nominates name + email only. Columns I–P are intentionally empty at nomination time. There is no DRA data to preserve in those columns.
- The v1.0 R–Y block was designed assuming DRA fills I–P and referee only confirms/modifies. In v2.0, the referee is the sole source for I–P data — so it belongs in I–P directly.
- The existing sheet has no column conflicts to worry about: I–P will be empty for all new nominations.
- The R–Y block covers all confirmation-tracking concerns: token (R), status (S), timestamps (T, U), weekend confirm/decline (V, W), and notes (Y).
- Column X (RefHotel) in v1.0 was a single hotel field. For v2.0, hotel is per-weekend (hotel needed for Weekend 1, hotel needed for Weekend 2). The existing N (Hotel Wk1) and O (Hotel Wk2) columns already capture this per-weekend structure. The referee fills N and O directly.
- Column X (RefHotel) becomes redundant — repurpose as a late-submission flag (see below) or leave unused.

**Exception — Late submission flag:** The v2.0 workflow requires flagging late submissions. Rather than add a new column, repurpose column X (currently "RefHotel") as "LateFlag" — write "Y" if the submission arrives after the ConfirmationDeadline. The per-weekend hotel data lives in N and O.

**Revised column X purpose for v2.0:**

| Col | Header (v2.0) | Content |
|-----|---------------|---------|
| X | LateFlag | "Y" if submitted after ConfirmationDeadline; blank otherwise |

---

## Architectural Decision 2: DRA Nomination Form — Simplify or Replace?

**The question:** The existing `spring-state-cup-nomination.html` collects ~14 fields per referee. In v2.0, the DRA provides only name + email. Should we modify the existing form or create a new one?

**Option A: Modify the existing form**

Remove the phone, age, capacity, availability, hotel, and day notes fields. Keep only first name, last name, email, and DRA notes.

Pro: One fewer HTML file to maintain.
Con: The existing form has ~689 lines — stripping fields while preserving the upload feature and visual layout is fiddly and risky.
Con: The XLSX template download must be regenerated with a simpler header set.
Con: Modifying in place risks breaking an existing working form.
Con: v1.0 form is currently in production use — if v2.0 is being built alongside it, replacing the file mid-cycle is a problem.

**Option B: Create a new file (nomination-v2.html or similar)**

Build a fresh, smaller form for v2.0 with the exact fields needed.

Pro: The existing form continues to work unchanged during the transition.
Pro: The new form is simpler code — probably 200-300 lines instead of 689.
Pro: The upload feature can be redesigned for the v2.0 template (name + email columns only).
Pro: Clean break — no risk of accidentally breaking v1.0 nominations.
Con: Two nomination form files exist briefly during transition.

**Recommendation: Create a new file**

The risk profile is clear: modifying an existing working form under time pressure is a higher-risk path than building a smaller new form. The new form is much simpler (no capacity dropdowns, no availability checkboxes, no hotel toggles). Name it `spring-state-cup-nomination.html` once the v2.0 workflow replaces v1.0, or name it differently during development to allow parallel testing.

The spreadsheet upload feature is worth retaining. In v2.0, the upload template contains: First Name, Last Name, Email, DRA Notes — four columns instead of thirteen.

---

## Architectural Decision 3: Apps Script doPost Routing for v2.0

**The question:** The simplified DRA nomination (name + email) and the new referee detail submission must both go through doPost. How does action-based routing look in v2.0?

### Current doPost (v1.0)

```
doPost(e):
  data = JSON.parse(e.postData.contents)
  action = data.action  (not currently used — implicit "nominate")
  → append nomination row to sheet (all 17 fields)
```

### v2.0 doPost Routing

```
doPost(e):
  data = JSON.parse(e.postData.contents)
  action = data.action

  "nominateV2"        → handleNominationV2(data)
                          receives: { draName, draEmail, district, refs: [{firstName, lastName, refEmail, draNotes}] }
                          for each ref:
                            check if refEmail already exists in sheet (token reuse logic)
                            if exists: update DRA info, preserve existing token
                            if new: append row with A-H, Q filled; I-P blank; R-Y blank
                          → return { status: "ok", count: N }

  "submitDetails"     → handleRefereeDetails(data)
                          receives: { token, phone, age, maxAR, maxRef, availability, hotelWk1, hotelWk2, dayNotes, notes }
                          find row by token
                          check deadline: if past deadline, set LateFlag (col X) = "Y"
                          check status: if Completed and past deadline, reject edit
                          write to I, J, K, L, M, N, O, P (referee-provided fields)
                          write to U (ConfirmedAt), V, W (per-weekend decisions), Y (notes)
                          set S (Status) = "Completed"
                          → return { status: "ok", late: boolean }

  (legacy/no action)  → existing nomination logic OR error
```

### v2.0 doGet Routing

```
doGet(e):
  action = e.parameter.action

  "getDetails"        → handleGetDetails(e.parameter)
                          receives: { token }
                          find row by token
                          check deadline: return context.isPastDeadline = true/false
                          return {
                            status: "ok",
                            data: {
                              firstName, lastName,
                              draName, district,
                              currentDetails: { phone, age, maxAR, maxRef, availability,
                                                hotelWk1, hotelWk2, dayNotes, notes },
                              weekends: { wk1Date: "May 16-17", wk2Date: "May 23-24" },
                              assignorEmail: "...",
                              confirmationStatus: col S value,
                              isPastDeadline: boolean,
                              deadline: col Z value (formatted date string)
                            }
                          }
                          // if status is "Completed" and past deadline:
                          //   return data with isPastDeadline: true (form renders read-only)
```

**Key routing insight:** In v2.0, the referee form is called `referee-details.html` (or `confirm.html` retained for URL stability). It fetches the referee's current data via doGet on load, renders a form, and POSTs the completed details via doPost with action `submitDetails`.

---

## Architectural Decision 4: Token Generation — When?

**The question:** When is the token created — on DRA nomination, or when the assignor opens the admin page?

**Option A: Token created at nomination time (doPost, when row is appended)**

- Every row gets a token immediately when the DRA nominates.
- The admin email page (which builds mailto links) finds tokens already present.
- No token-generation step needed on the admin page.

Pro: Admin page is simpler — it reads tokens, it does not create them.
Pro: Re-nomination of existing referee (same email) finds existing token and reuses it — no extra logic needed.
Con: Tokens exist in the sheet for rows where no email will ever be sent (if assignor excludes some nominees).

**Option B: Token created when assignor accesses admin page**

- Rows have no token until the assignor triggers the email workflow.
- The admin page calls an Apps Script endpoint that generates tokens for rows that don't have one.

Pro: Tokens only exist for referees the assignor intends to contact.
Con: Admin page now requires an Apps Script call before it can render links.
Con: Re-nomination of existing referee requires the admin page to check for existing tokens before generating new ones — more logic.

**Recommendation: Option A — generate token at nomination time**

Rationale:
- The re-nomination / token-reuse decision (same email = same token) is cleanest when token generation lives in the nomination doPost: check if a row with that email already exists, and if so, return the existing token and row update rather than appending a new row.
- The admin page becomes a pure read operation: fetch all rows with emails, render mailto links using existing tokens. No write needed at admin page load time.
- Token generation in doPost is one extra line: `var token = Utilities.getUuid()`. The cost is negligible.

**Re-nomination / token-reuse logic in doPost (nominateV2 action):**

```
for each referee in the submitted refs array:
  existing = findRowByEmail(sheet, refEmail)
  if existing:
    update cols B, C, D, Q (DRA info, DRA notes) on the existing row
    token = existing row's col R value (preserve existing token)
  else:
    token = Utilities.getUuid()
    append new row with A-H filled, Q filled, I-P blank, R = token, S = "Not Sent"
```

This handles the "same referee, new tournament cycle or re-nomination" scenario without breaking existing links.

---

## Architectural Decision 5: Email Admin Page — Apps Script Menu vs. Static HTML

**The constraint:** The assignor uses Microsoft 365/Outlook. Emails must be sent via `mailto:` links that open Outlook — not MailApp, not GmailApp.

**v1.0 recommendation was an Apps Script menu.** That was correct for MailApp-based sending. In v2.0, mailto links must be generated as HTML links. Apps Script's `SpreadsheetApp.getUi()` menu cannot render clickable mailto links. The assignor needs an HTML page.

**Recommendation: Static HTML admin page on GitHub Pages**

- The admin page (`email-admin.html` or similar) is a static HTML file on GitHub Pages.
- On load, it fetches all nomination rows via a `doGet` call (new action: `getAllNominees`).
- It renders a table of nominees, each with a clickable `mailto:` link pre-built with the referee's name, nominated weekends, and the token-secured detail form URL.
- The assignor clicks each link (or uses "open all" or similar) to launch Outlook pre-composed emails.
- Status is visible in the table (Not Sent / Pending / Completed).

**New doGet action needed: getAllNominees**

```
doGet with action=getAllNominees:
  read all rows from sheet
  return array of: { firstName, lastName, refEmail, district, draName, token, status, availability (M), draWk1 (N), draWk2 (O) }
  (token is needed to build the confirm URL in the client)
```

This endpoint returns data for all nominees. The HTML page constructs the mailto links client-side, embedding the referee's detail form URL.

**Security note:** The admin page has no authentication. The `getAllNominees` endpoint returns referee emails and tokens. This is the same level of security as the existing nomination form (the Apps Script URL is visible in the HTML source). The PROJECT.md explicitly states "security isn't a major concern" for this workflow. If the admin page URL is kept unlisted and not linked from any public page, the risk is acceptable.

---

## Full System Overview: v2.0

```
+----------------------------------+       +----------------------------------+
|         GitHub Pages              |       |      Google Apps Script          |
|                                  |       |          (/exec URL)             |
|  spring-state-cup-nomination.html|  POST |                                  |
|  (simplified: name+email only)  -------> | doPost action=nominateV2         |
|                                  |       |   → token lookup by email        |
|                                  |       |   → append or update row         |
|                                  |       |   → return { ok, count }         |
|                                  |       |                                  |
|  email-admin.html                |  GET  |                                  |
|  (assignor tool)                -------> | doGet action=getAllNominees       |
|    renders nominee list          |       |   → return all rows as JSON      |
|    with mailto: links            |       |                                  |
|    (opens Outlook)               |       |                                  |
|                                  |       |                                  |
|  referee-details.html            |  GET  |                                  |
|  (referee form, token-secured)  -------> | doGet action=getDetails          |
|    on load: fetch pre-fill       |       |   → validate token               |
|    on submit: POST details  -------POST->|   → return referee data + context|
|                                  |       |                                  |
|                                  |       | doPost action=submitDetails      |
|                                  |       |   → validate token               |
|                                  |       |   → check deadline               |
|                                  |       |   → write I-P, U, V, W, X, Y    |
|                                  |       |   → set S = "Completed"          |
|                                  |       |   → return { ok, late }          |
+----------------------------------+       +----------------------------------+
                                                       |
                                                       | read/write
                                                       v
                                           +------------------------+
                                           |      Google Sheet      |
                                           |                        |
                                           | A-H, Q: DRA-provided   |
                                           |   (name, email, DRA    |
                                           |    info, DRA notes)    |
                                           |                        |
                                           | I-P: referee-provided  |
                                           |   (phone, age, avail,  |
                                           |    hotel, day notes)   |
                                           |   [blank until referee |
                                           |    submits]            |
                                           |                        |
                                           | R: Token               |
                                           | S: Status              |
                                           | T: SentAt (unused in   |
                                           |    v2.0 — no server    |
                                           |    send, so optional)  |
                                           | U: ConfirmedAt         |
                                           | V: RefWeekend1         |
                                           | W: RefWeekend2         |
                                           | X: LateFlag            |
                                           | Y: RefNotes            |
                                           | Z: ConfirmationDeadline|
                                           +------------------------+
```

---

## Component Inventory

### New Components

| Component | File | Purpose |
|-----------|------|---------|
| Simplified DRA nomination form | `spring-state-cup-nomination.html` (new version) | DRA submits name + email per referee; replaces existing form |
| Referee detail form | `referee-details.html` | Referee fills own details via token-secured link |
| Email admin page | `email-admin.html` | Assignor sees all nominees, clicks mailto: links to send Outlook emails |

### Modified Apps Script Functions

| Function | Change |
|----------|--------|
| `doPost(e)` | Add routing: `action=nominateV2` for simplified nomination; `action=submitDetails` for referee detail submission |
| `doGet(e)` | Add (new function): `action=getDetails` for referee pre-fill; `action=getAllNominees` for admin page |

### Modified Google Sheet

| Change | Detail |
|--------|--------|
| Column X repurposed | Header changes from "RefHotel" to "LateFlag"; v2.0 only writes "Y" or blank |
| Columns I–P writer changes | These columns are now written by referee detail submission (doPost/submitDetails) instead of the DRA nomination form |
| No new columns needed | All referee detail data fits in existing I–P and V–Y blocks |

### Unchanged Components

| Component | Status |
|-----------|--------|
| `index.html` | No change needed |
| Brand assets (logo.webp, TNRefLOGO.png) | No change |
| Sheet columns A–H, Q, R–W, Y, Z | Unchanged purpose and indices |
| `ConfirmationDeadline` named range at Z1 | Unchanged |

---

## Data Flows

### Flow 1: DRA Nominates (v2.0 Simplified Submission)

```
DRA selects name from dropdown (auto-fills district + email)
DRA adds referees (first name, last name, email) — manually or via spreadsheet upload
DRA submits

  → fetch() POST to Apps Script /exec
  → body: { action: "nominateV2", draName, draEmail, district,
            refs: [{ firstName, lastName, refEmail, draNotes }, ...] }

  → Apps Script doPost:
      for each ref:
        search col H for matching refEmail
        if found (re-nomination):
          update cols B (DRA Name), C (DRA Email), D (District), Q (DRA Notes)
          DO NOT regenerate token — preserve existing col R value
          set S = "Not Sent" (reset status for new cycle if needed — implementation decision)
        if not found:
          token = Utilities.getUuid()
          append new row: A=timestamp, B=draName, C=draEmail, D=district,
                          E=refNum, F=firstName, G=lastName, H=refEmail,
                          I–P = blank, Q=draNotes,
                          R=token, S="Not Sent", T–Y = blank
      return { status: "ok", count: N }

  → Form shows success message
```

### Flow 2: Assignor Opens Admin Page

```
Assignor navigates to email-admin.html in browser

email-admin.html on load:
  → fetch(SCRIPT_URL + "?action=getAllNominees")

  → Apps Script doGet:
      read all rows from sheet
      return JSON array of nominee objects:
        [{ firstName, lastName, refEmail, district, draName,
           token, status, wk1: col N, wk2: col O }, ...]

email-admin.html renders table:
  each row: [Name] [Email] [Status] [Weekends] [Click to Send Email]

  "Click to Send Email" is a mailto: link:
    mailto:{refEmail}
    ?subject=State Cup 2026 — Your Referee Nomination
    &body=Hi {firstName},%0D%0A%0D%0AYou have been nominated...%0D%0A%0D%0APlease fill out your details here:%0D%0Ahttps://[github-pages-url]/referee-details.html?token={token}

Assignor clicks each link → Outlook opens with pre-composed email
Assignor reviews and sends
```

**Note on SentAt (column T):** In v2.0 the server never sends email — the assignor sends manually via Outlook. Column T (SentAt) cannot be written automatically. It can either be left blank in v2.0, or the admin page can call a lightweight Apps Script endpoint to mark a row as emailed (writing T and setting S = "Pending") when the assignor clicks the mailto link. The simpler choice: omit writing T in v2.0; the assignor's Outlook Sent folder is the record of sent emails. Status S advances from "Not Sent" to "Pending" only when the referee opens their link (an optional enhancement) or the assignor marks it manually.

**Revised status lifecycle for v2.0:**
- "Not Sent" — row exists, no email sent
- "Pending" — email sent (assignor manually updates, or auto-set when referee first opens their link)
- "Completed" — referee submitted details (auto-set by doPost/submitDetails)

"Declined" is no longer a primary status: in v2.0, the referee can decline individual weekends but still submits their details. A referee who declines all weekends still has status "Completed" with V and W both set to "Declined".

### Flow 3: Referee Opens Detail Form

```
Referee receives email, clicks link:
  https://[org].github.io/[repo]/referee-details.html?token=UUID

referee-details.html on load:
  → reads token from URL: new URLSearchParams(location.search).get('token')
  → if no token: show error state with assignor contact

  → fetch(SCRIPT_URL + "?action=getDetails&token=" + token)

  → Apps Script doGet:
      find row by token (scan col R)
      if not found: return { status: "error", message: "Invalid link" }
      read ConfirmationDeadline from named range Z1
      isPastDeadline = (now() > deadline)
      return {
        status: "ok",
        data: {
          firstName, lastName, draName, district,
          currentDetails: { phone: col I, age: col J, maxAR: col K,
                            maxRef: col L, availability: col M,
                            hotelWk1: col N, hotelWk2: col O,
                            dayNotes: col P },
          weekends: { wk1: "May 16-17, 2026", wk2: "May 23-24, 2026" },
          assignorEmail: "[hardcoded or from script property]",
          confirmationStatus: col S,
          isPastDeadline: isPastDeadline,
          deadline: formatted deadline string
        }
      }

referee-details.html renders form:
  if isPastDeadline AND status = "Completed": render read-only summary, no submit button
  if isPastDeadline AND status != "Completed": render form with "LATE SUBMISSION" notice
  if not past deadline: render normal form
  pre-fill all fields from currentDetails (if referee has submitted before, their data is shown)
```

### Flow 4: Referee Submits Details

```
Referee completes form, clicks "Submit My Details"

  → fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "submitDetails",
        token: token,
        phone: ..., age: ..., maxAR: ..., maxRef: ...,
        wk1: "Confirmed" | "Declined",
        wk2: "Confirmed" | "Declined",
        hotelWk1: true/false,
        hotelWk2: true/false,
        dayNotes: ...,
        notes: ...
      })
    })

  → Apps Script doPost (submitDetails branch):
      LockService.getScriptLock().waitLock(10000)
      find row by token (scan col R)
      if not found: return error
      read deadline from ConfirmationDeadline named range
      isPastDeadline = (now() > deadline)
      if isPastDeadline AND status = "Completed":
        return { status: "error", message: "Deadline has passed" }
      write to sheet:
        col I (Phone) = phone
        col J (Age) = age
        col K (MaxAR) = maxAR
        col L (MaxRef) = maxRef
        col M (Availability) = "Weekend 1, Weekend 2" | "Weekend 1" | "Weekend 2" | "None"
        col N (HotelWk1) = "Yes" / "No"
        col O (HotelWk2) = "Yes" / "No"
        col P (DayNotes) = dayNotes
        col U (ConfirmedAt) = now()
        col V (RefWeekend1) = wk1
        col W (RefWeekend2) = wk2
        col X (LateFlag) = isPastDeadline ? "Y" : ""
        col Y (RefNotes) = notes
        col S (Status) = "Completed"
      return { status: "ok", late: isPastDeadline }

referee-details.html receives success:
  if late = true: show "Submitted — note: this submission is past the deadline" notice
  else: show "Thank you! Your details have been submitted." success screen
```

---

## Sheet Schema: Before and After

### v1.0 vs v2.0 Column Writers

| Col | Header | v1.0 writer | v2.0 writer | Notes |
|-----|--------|-------------|-------------|-------|
| A–H | Core nomination fields | DRA form (all 17 fields) | DRA form (name+email only) | A–H scope unchanged |
| I | Phone | DRA form | Referee detail form | **Writer changes** |
| J | Age | DRA form | Referee detail form | **Writer changes** |
| K | Max Age as AR | DRA form | Referee detail form | **Writer changes** |
| L | Max Age as Referee | DRA form | Referee detail form | **Writer changes** |
| M | Availability | DRA form | Referee detail form | **Writer changes** |
| N | Hotel Wk1 | DRA form | Referee detail form | **Writer changes** |
| O | Hotel Wk2 | DRA form | Referee detail form | **Writer changes** |
| P | Day Notes | DRA form | Referee detail form | **Writer changes** |
| Q | DRA Notes | DRA form | DRA form (retained) | Unchanged |
| R | Token | Setup script / doPost | doPost nominateV2 | Token generation moves into nomination flow |
| S | Status | Setup script default | doPost nominateV2 / submitDetails | Status transitions in nomination and detail submission |
| T | SentAt | (Phase 4 planned) | Not auto-written (mailto, no server send) | Assignor must manually update or leave blank |
| U | ConfirmedAt | Confirmation form (v1.0) | Referee detail form | Same purpose |
| V | RefWeekend1 | Confirmation form (v1.0) | Referee detail form | Same purpose |
| W | RefWeekend2 | Confirmation form (v1.0) | Referee detail form | Same purpose |
| X | RefHotel | Confirmation form (v1.0) | **LateFlag** | **Purpose changes** |
| Y | RefNotes | Confirmation form (v1.0) | Referee detail form | Same purpose |

### Key Insight: No New Columns Required

All v2.0 referee detail data (phone, age, max ages, availability, hotel, day notes) maps directly to the existing A–Q columns. The R–Y block covers confirmation/detail metadata. No schema migration is needed for v2.0 — the existing column structure (written by setup scripts in v1.0 Phase 1) accommodates v2.0 without changes, except repurposing column X.

---

## Suggested Build Order

Build order follows the dependency chain: schema must be stable before scripts reference it; doPost/doGet must work before HTML pages can be tested end-to-end; the admin email page embeds the referee form URL so it must come last.

### Step 1: Verify/Update Sheet Schema

Confirm column X header changes from "RefHotel" to "LateFlag". Update Status dropdown validation if "Declined" is being demoted from a primary status. Verify the nomination form's doPost still writes correctly to A–H and Q only (not I–P).

**This step is required before any doPost/doGet code is written.** Column indices must be confirmed stable.

**Dependency:** Nothing. First step.

### Step 2: Simplify DRA Nomination Form

Build the v2.0 nomination form — DRA selects their name, then adds referees with just first name, last name, email, and optional DRA notes. Retain the spreadsheet upload feature with a simplified template (4 columns). The form posts `action=nominateV2` to doPost.

This can be built and tested client-side (validations, upload parsing) before the Apps Script is updated, as long as the SHEET_URL endpoint exists. The doPost handler in Step 3 can be added in parallel or immediately after.

**Dependency:** Schema from Step 1.

### Step 3: Apps Script — doPost nominateV2 + doGet getDetails + doPost submitDetails

All three endpoints can be written in a single script edit and deployed together. The three routes are independent of each other but all reference the same sheet schema.

Sub-order within this step:
1. `nominateV2` in doPost — simplest, extends existing nomination logic
2. `getDetails` in doGet — new function, returns referee data by token
3. `submitDetails` in doPost — writes referee fields back to sheet

Test `nominateV2` by submitting the new DRA form and verifying sheet rows.
Test `getDetails` by navigating to `[exec-url]?action=getDetails&token=TEST` in a browser.
Test `submitDetails` by POSTing a manually crafted payload with a real token from the sheet.

Redeploy as a new version after all three routes are added.

**Dependency:** Schema from Step 1. Simplified form from Step 2 (to test nominateV2 end-to-end, but nominateV2 can be tested standalone with a manual POST first).

### Step 4: doGet getAllNominees (admin endpoint)

A straightforward doGet route that returns all rows. Add to the same deployment as Step 3 or as a follow-on redeploy.

**Dependency:** Step 3 (same deployment, same script file).

### Step 5: Referee Detail Form (referee-details.html)

Build the referee-facing form. It fetches pre-fill data from `getDetails` (Step 3) and POSTs to `submitDetails` (Step 3). UI states: loading, form (normal), form (late notice), read-only (past deadline + completed), error, success.

Style to match the existing nomination form (same CSS variables, same Open Sans, same color scheme).

**Dependency:** Steps 3 must be deployed and working. The referee form URL must be finalized here — the admin email page (Step 6) embeds this URL in mailto links.

### Step 6: Email Admin Page (email-admin.html)

Build the assignor-facing page. On load, fetches `getAllNominees` (Step 4). Renders each referee with a mailto link pre-built with the token-secured referee form URL from Step 5.

**Dependency:** Steps 4 and 5 must both be complete. The referee form URL is embedded in the mailto link body.

### Summary Build Order

```
1. Verify/update sheet schema (X header, status values)
2. Simplified DRA nomination form (client-side complete)
3. Apps Script: doPost nominateV2 + doGet getDetails + doPost submitDetails → deploy
4. Apps Script: doGet getAllNominees → redeploy (can be same edit as step 3)
5. Referee detail form (referee-details.html)
6. Email admin page (email-admin.html)
```

Steps 3 and 4 are a single script edit/deployment in practice.
Steps 5 and 6 can be built in parallel once Step 3/4 are deployed, but Step 6 requires the URL from Step 5.

---

## Architecture Patterns to Follow

### Pattern 1: Action-Based Routing — Explicit, Delegating

Each doPost/doGet routes by action string to a named handler function. The dispatcher is thin; logic lives in handlers.

```javascript
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var action = data.action;
  if (action === 'nominateV2') return handleNominationV2(data);
  if (action === 'submitDetails') return handleSubmitDetails(data);
  // Legacy path — handle original nomination format or return error
  return handleLegacyNomination(data);
}

function doGet(e) {
  var action = e.parameter.action;
  if (action === 'getDetails') return handleGetDetails(e.parameter);
  if (action === 'getAllNominees') return handleGetAllNominees();
  return jsonError('Unknown action');
}
```

### Pattern 2: Token Lookup — Single Batch Read

Read all row data once per request. Never call `.getValue()` per row in a loop (each is a separate Sheets API call with latency overhead).

```javascript
function findRowByToken(sheet, token) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {  // row 0 = header
    if (data[i][17] === token) {            // col R = index 17, 0-based
      return { rowIndex: i + 1, rowData: data[i] };  // rowIndex is 1-based for sheet ops
    }
  }
  return null;
}
```

### Pattern 3: Token Reuse on Re-Nomination

Before appending a new row, check if the referee email already exists. If so, update the existing row and preserve the token. The referee's link never changes across nomination cycles.

```javascript
function findRowByEmail(sheet, email) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][7] === email) {  // col H = index 7, 0-based
      return { rowIndex: i + 1, rowData: data[i] };
    }
  }
  return null;
}
```

### Pattern 4: Deadline Check — Named Range Read

Read the ConfirmationDeadline named range once per request that needs it. Do not hardcode the deadline date in the script.

```javascript
function isPastDeadline(ss) {
  var deadline = ss.getRangeByName('ConfirmationDeadline').getValue();
  if (!deadline) return false;  // no deadline set = never past
  return new Date() > new Date(deadline);
}
```

### Pattern 5: Referee Form UI States

The referee detail form handles five distinct states. Only one is visible at a time.

```
State 1: Loading        — spinner shown while fetching from doGet
State 2: Form (normal)  — pre-filled form, editable, with submit button
State 3: Form (late)    — same as State 2 but with a "LATE SUBMISSION" notice banner
State 4: Read-only      — form fields shown but not editable; no submit button
                          (past deadline AND status = "Completed")
State 5: Error          — invalid token, network error, or server error
                          Shows assignor contact email and retry option
State 6: Success        — post-submit confirmation screen
                          If late = true, includes "note: past the deadline" notice
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Sending Referee Detail Data to Columns I–P from the DRA Form

The DRA form in v2.0 must not write to columns I–P. Those fields should be absent from the form entirely (not just submitted as empty strings, which could overwrite existing referee-provided data on a re-nomination).

**Do this:** The v2.0 DRA form submits only: draName, draEmail, district, refs[{firstName, lastName, refEmail, draNotes}]. The doPost nominateV2 handler writes only A–H and Q.

**Not this:** Submitting the full 14-field row from the old form with empty values for I–P, which would overwrite referee-provided data if the DRA re-nominates someone.

### Anti-Pattern 2: Generating a New Token for a Re-Nominated Referee

If a referee who received their detail form link in a previous cycle is re-nominated, generating a new token invalidates their existing link. If they try to use the old link, they get an "invalid token" error.

**Do this:** `findRowByEmail()` before generating a token. If a row exists, reuse the existing token from col R.

### Anti-Pattern 3: Writing to Column T (SentAt) Automatically

In v2.0, email is sent by the assignor via Outlook/mailto — the server never knows when email was sent. Attempting to write a SentAt timestamp in the `getAllNominees` doGet (when the admin page loads) would mark rows as "sent" before the assignor actually sends the email.

**Do this:** Leave col T blank in v2.0, or provide an optional "mark as sent" endpoint the admin page calls after the assignor confirms they sent the email (e.g., via a checkbox or button next to each mailto link).

### Anti-Pattern 4: Blocking Re-Submission Before the Deadline

The referee must be able to edit their details until the deadline passes. The `submitDetails` handler should overwrite existing I–P data (not guard against re-submission).

**Only block** when: `isPastDeadline AND status = "Completed"`.

### Anti-Pattern 5: Inserting Columns Into the Sheet

Never use `sheet.insertColumns()` or `sheet.insertColumnAfter()`. Always append to the right end of the existing schema. Inserting shifts column indices for all existing Apps Script code and the nomination form's doPost, breaking them silently.

---

## Integration Points Summary

| Point | What Changes | Risk |
|-------|-------------|------|
| `doPost(e)` | Add `nominateV2` branch; add `submitDetails` branch | Low — existing nomination logic untouched if action routing is clean |
| `doGet(e)` | Add new function; two new routes (`getDetails`, `getAllNominees`) | Low — does not affect doPost |
| Columns A–H, Q | Written by new simplified DRA form — same fields, same doPost path | Low |
| Columns I–P | No longer written by DRA form; now written by referee detail form | Medium — must ensure DRA form does NOT send these fields |
| Column X | Header and purpose change from RefHotel to LateFlag | Low — one-time update, no impact on other columns |
| Column S | Status values contract slightly (Declined becomes less common) | Low |
| `spring-state-cup-nomination.html` | Replace with v2.0 simplified form | Medium — new form requires testing; old form stays available as backup until verified |
| New `referee-details.html` | New file; full development | Medium — main new development |
| New `email-admin.html` | New file; full development | Medium — simpler than referee form |
| `SHEET_URL` constant | Unchanged — same Apps Script /exec URL | None |
| `ConfirmationDeadline` named range | Unchanged | None |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Sheet schema decisions (I–P writer change, X repurpose) | HIGH | Based on direct codebase inspection and clear v2.0 requirements |
| Action-based routing in doPost/doGet | HIGH | Existing working doPost confirms this pattern; well-documented Apps Script behavior |
| Token generation at nomination time | HIGH | Cleaner than admin-page generation; solves re-nomination / token-reuse elegantly |
| Mailto email approach | HIGH | Confirmed project constraint (Microsoft 365/Outlook); no server-side email |
| Admin page as static HTML (vs Apps Script menu) | HIGH | Apps Script UI menus cannot render clickable mailto: links in a useful way |
| Token reuse for re-nominated referees | HIGH | findRowByEmail() is a trivial column scan at this scale |
| No new columns required | HIGH | Verified by mapping all v2.0 referee detail fields to existing I–P and V–Y columns |
| LockService for submitDetails | HIGH | Standard guard for concurrent writes; one-liner |
| CORS behavior on doGet/doPost | HIGH | Confirmed by existing nomination form working cross-origin from GitHub Pages |

---

*Architecture research for: State Cup Referee Nominations v2.0 — DRA submits name+email, referee provides own details*
*Researched: 2026-03-19*
