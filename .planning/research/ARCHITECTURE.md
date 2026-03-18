# Architecture Research: Referee Confirmation System

**Project:** State Cup Referee Nominations — Confirmation System (v1.0)
**Researched:** 2026-03-17
**Confidence:** HIGH for Apps Script fundamentals (well-established platform, existing codebase confirms patterns); MEDIUM for specific quota values (training data, unverified against current Google documentation)

---

## Existing Architecture (Baseline)

Before defining integration points, the current system must be understood exactly.

```
GitHub Pages (static hosting)
  index.html           — meta-redirect to nomination form
  spring-state-cup-nomination.html  — nomination form (inline CSS/JS, ~689 lines)
  logo.webp, TNRefLOGO.png         — brand assets

Google Apps Script Web App (single deployment)
  doPost(e)            — receives JSON from nomination form, validates, appends rows to sheet
  No doGet() defined   — currently unused

Google Sheet ("Spring State Cup 2026 — Referee Nominations")
  Row 1: headers (A-Q, 17 columns)
  Rows 2+: one row per nominated referee
```

Data flow (nomination, already built):

```
Referee clicks Submit on GitHub Pages form
  → fetch() POST to Apps Script /exec URL with JSON body
    → doPost validates, appends row to Google Sheet
      → returns { status: "ok" } JSON
        → form shows success message
```

Key existing constraints observed in code:
- `SHEET_URL` is hardcoded in the HTML (visible in source — documented as acceptable)
- No authentication on the Apps Script endpoint
- Single active sheet (`getActiveSheet()`)
- All server logic in one Apps Script project file

---

## Integration Architecture: Token-Based Confirmation

### Decision 1: Where Does the Confirmation Page Live?

**Two options exist:**

**Option A: Confirmation page on GitHub Pages (static HTML)**

```
confirm.html (GitHub Pages)
  → on load, reads ?token= from URL
  → fetches Apps Script GET endpoint with token
  → Apps Script looks up token in sheet, returns referee data as JSON
  → page renders pre-filled form
  → referee submits → POST to Apps Script
  → Apps Script updates sheet row
```

**Option B: Confirmation page served by Apps Script HtmlService**

```
Apps Script doGet(e)
  → reads e.parameter.token
  → looks up referee in sheet
  → returns HtmlService.createTemplateFromFile(...).evaluate()
  → sends fully-rendered HTML page to browser
```

**Recommendation: Option A (GitHub Pages static HTML)**

Rationale:
- Consistent with existing architecture: all HTML/CSS/JS lives on GitHub Pages
- Apps Script HtmlService has a different URL pattern (`/exec?token=...` still works, but the response is a full HTML page served from `script.google.com`, not your domain)
- HtmlService pages are harder to style and debug — they render inside an iFrame in some contexts
- Static file on GitHub Pages is simpler to maintain alongside `spring-state-cup-nomination.html`
- CORS on Apps Script with `ContentService` (JSON) works fine for cross-origin fetch from GitHub Pages — this is already proven by the existing nomination form
- Keeping HTML on GitHub Pages means the assignor can share the confirmation link and it uses the same domain as the nomination form

**Confidence:** HIGH — this matches the established pattern in the project and avoids Apps Script HtmlService complexity.

---

### Decision 2: How Does the Apps Script Web App Handle Both Nomination POSTs and Confirmation GETs/POSTs?

Apps Script web apps support exactly one `doGet(e)` and one `doPost(e)` function per deployment. Both can be defined simultaneously in the same script file. The same `/exec` URL handles both HTTP methods.

**Routing strategy:** Use an `action` parameter to distinguish confirmation requests from nomination requests within each handler.

```
doGet(e):
  action = e.parameter.action

  if action == "getConfirmation":
    → look up token, return referee JSON
  else:
    → return 404-equivalent error JSON

doPost(e):
  data = JSON.parse(e.postData.contents)
  action = data.action

  if action == "submitConfirmation":
    → validate token, update sheet row
  else (no action or action == "nominate"):
    → existing nomination logic (unchanged)
```

**Why action-based routing over URL paths?**

Apps Script web apps have a single endpoint (`/exec`). There is no path-based routing — `/exec/confirm` is not valid. All routing must happen via query parameters (for GET) or request body (for POST). Using an explicit `action` field is the conventional pattern.

**Critical CORS note:** Apps Script's `ContentService.createTextOutput(...).setMimeType(JSON)` responses permit cross-origin requests when the deployment is set to "Anyone" access. This is already working for the nomination form. The same permissive behavior applies to `doGet()` returning JSON. No additional CORS headers need to be set — Apps Script handles this automatically for public deployments. (Confidence: HIGH, confirmed by existing working nomination form.)

**Deployment consideration:** Adding `doGet()` to the existing script requires redeploying the Apps Script as a new version. The existing `/exec` URL remains the same — only the internal code version changes. The HTML file's `SHEET_URL` constant does not need to change.

---

### Decision 3: How to Structure the Google Sheet Columns for Confirmation Data?

**Existing columns (A–Q, 17 columns):**

| Col | Header | Content |
|-----|--------|---------|
| A | Timestamp | Nomination submission time |
| B | DRA Name | |
| C | DRA Email | |
| D | District | |
| E | Referee # | Sequential within DRA submission |
| F | First Name | |
| G | Last Name | |
| H | Referee Email | Used for sending confirmation email |
| I | Phone | |
| J | Age | |
| K | Max Age as AR | |
| L | Max Age as Referee | |
| M | Availability | "Weekend 1, Weekend 2" or similar |
| N | Hotel — Weekend 1 | Yes/No |
| O | Hotel — Weekend 2 | Yes/No |
| P | Day-Specific Notes | |
| Q | DRA Notes | |

**New columns to append (R–X):**

| Col | Header | Content | Notes |
|-----|--------|---------|-------|
| R | Confirmation Token | UUID (e.g. `a3f8-...`) | Generated when email is sent; blank until then |
| S | Confirmation Status | `Pending` / `Confirmed` / `Declined` | Set to `Pending` when token generated |
| T | Confirmation Sent At | ISO timestamp | When email was sent |
| U | Confirmed At | ISO timestamp | When referee submitted confirmation form |
| V | Ref: Availability | Referee's confirmed availability | May differ from DRA's original (col M) |
| W | Ref: Hotel Wk1 | Referee's confirmed hotel need | May differ from col N |
| X | Ref: Hotel Wk2 | Referee's confirmed hotel need | May differ from col O |
| Y | Ref: Notes | Referee's free-text notes to assignor | New field, not in nomination form |

**Why separate "Ref:" columns rather than overwriting DRA columns:**

- Preserves the original nomination data as entered by the DRA
- Allows assignor to see discrepancies between what DRA entered and what referee confirmed
- Avoids destructive writes — simpler to implement safely
- Assignor can sort/filter by Confirmation Status (col S) to track progress

**Token format recommendation:** Use `Utilities.getUuid()` in Apps Script (built-in, no library needed). Produces a standard UUID v4. Sufficient entropy for this scale (50-100 referees). Do not use row numbers or referee names as tokens.

**Finding referee row by token:** Apps Script must scan column R to find the row matching the incoming token. With 50-100 rows this is trivially fast. Use `getDataRange().getValues()` to read all rows, then find matching token index. No database indexing needed at this scale.

---

### Decision 4: How Should the "Send Emails" Trigger Work?

**Three options exist:**

**Option A: Apps Script menu item**
- Custom menu added via `onOpen()` trigger: "State Cup > Send Confirmation Emails"
- Runs a function that scans sheet for rows with email but no token, generates tokens, sends emails

**Option B: Button in a separate admin HTML page (GitHub Pages)**
- Admin page posts to Apps Script endpoint with an admin action
- Apps Script sends emails and returns results

**Option C: Manually run function in Apps Script editor**
- Assignor opens Apps Script editor and runs function by hand

**Recommendation: Option A (Apps Script menu item)**

Rationale:
- Assignor already works in the Google Sheet
- Custom menus are a well-established Apps Script pattern for sheet-based admin actions
- No additional HTML page to maintain
- Natural workflow: assignor reviews nominations in sheet, then clicks menu to send emails
- Menu can also include a "Close Confirmations" option for when assignments are ready
- No need to expose an admin-authenticated endpoint

Implementation sketch:

```javascript
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('State Cup')
    .addItem('Send Confirmation Emails', 'sendConfirmationEmails')
    .addItem('Close Confirmations', 'closeConfirmations')
    .addToUi();
}

function sendConfirmationEmails() {
  // Scan sheet for rows with referee email (col H) but no token (col R)
  // Generate token, write to col R, set status Pending in col S, send email
  // Report results via SpreadsheetApp.getUi().alert()
}
```

The `onOpen()` trigger fires automatically when the sheet is opened — no manual setup by assignor after initial deployment.

**Confidence:** HIGH — Apps Script custom menus are a core feature, well-documented.

---

## Full Data Flow

### Flow 1: Token Generation and Email Sending

```
Assignor opens Google Sheet
  → onOpen() fires → "State Cup" menu appears

Assignor clicks "State Cup > Send Confirmation Emails"
  → sendConfirmationEmails() runs in Apps Script
    → reads all rows from sheet
    → for each row where col H (ref email) is non-empty AND col R (token) is empty:
        1. token = Utilities.getUuid()
        2. confirmUrl = "https://[github-pages-url]/confirm.html?token=" + token
        3. write token to col R
        4. write "Pending" to col S
        5. write timestamp to col T
        6. MailApp.sendEmail({
             to: refEmail,
             subject: "State Cup 2026 — Please Confirm Your Availability",
             body: [email with referee name, confirmUrl, deadline info]
           })
    → shows alert: "X emails sent. Y skipped (no email address)."
```

### Flow 2: Referee Opens Confirmation Link

```
Referee receives email, clicks link:
  https://[org].github.io/[repo]/confirm.html?token=a3f8-xxxx

confirm.html loads in browser
  → JS reads token from URL: new URLSearchParams(location.search).get('token')
  → if no token: show "Invalid link" error state

  → fetch(SCRIPT_URL + "?action=getConfirmation&token=" + token)
      → Apps Script doGet(e):
          action = e.parameter.action  // "getConfirmation"
          token  = e.parameter.token
          → scan sheet column R for token
          → if not found: return { status: "error", message: "Invalid or expired link" }
          → if found:
              row = matching sheet row data
              return {
                status: "ok",
                data: {
                  firstName: row[F],
                  lastName:  row[G],
                  availability: row[M],   // DRA-entered
                  hotelWk1: row[N],
                  hotelWk2: row[O],
                  draName: row[B],
                  district: row[D],
                  confirmationStatus: row[S]
                }
              }

confirm.html receives JSON response
  → if already Confirmed: show "You have already confirmed" state
  → else: render pre-filled form with referee's current data
```

### Flow 3: Referee Submits Confirmation

```
Referee reviews pre-filled form, adjusts if needed, clicks "Confirm"
  → confirm.html JS:
      fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: "submitConfirmation",
          token: token,
          availability: [selected weekends],
          hotelWk1: boolean,
          hotelWk2: boolean,
          notes: string
        })
      })

      → Apps Script doPost(e):
          data = JSON.parse(e.postData.contents)
          action = data.action  // "submitConfirmation"
          token  = data.token
          → scan sheet column R for token
          → if not found: return error
          → validate data (availability must be non-empty array, etc.)
          → write to sheet row:
              col S (Status): "Confirmed"
              col U (Confirmed At): now()
              col V (Ref Availability): data.availability joined string
              col W (Ref Hotel Wk1): data.hotelWk1
              col X (Ref Hotel Wk2): data.hotelWk2
              col Y (Ref Notes): data.notes
          → return { status: "ok" }

confirm.html receives success response
  → show "Thank you! Your availability has been confirmed." message
  → disable form to prevent re-submission
```

### Flow 4: Assignor Closes Confirmations

```
Assignor clicks "State Cup > Close Confirmations"
  → Apps Script closeConfirmations():
      → For any remaining "Pending" rows (token exists, status = Pending):
          Set col S = "Closed — No Response"
      → Alert: "Confirmations closed. X referees marked as no response."
```

---

## New Components Required

### New Files (GitHub Pages)

| File | Purpose | Relationship to Existing |
|------|---------|--------------------------|
| `confirm.html` | Referee confirmation page | New file; mirrors style of `spring-state-cup-nomination.html` |

Note: `index.html` currently redirects to `spring-state-cup-nomination.html` — it does not need modification. The confirmation page is a separate entry point accessed only via email link.

### Modified Files (GitHub Pages)

| File | Change Needed |
|------|---------------|
| `spring-state-cup-nomination.html` | No changes needed — nomination flow is complete and separate |
| `SETUP-INSTRUCTIONS.txt` | Should be updated to document the new columns and menu trigger setup |

### Modified Apps Script (same project, same deployment URL)

| Function | Status | Change |
|----------|--------|--------|
| `doPost(e)` | Existing | Add `action` routing — nomination submissions now pass without `action` or pass `action: "nominate"`. Add branch for `action: "submitConfirmation"`. |
| `doGet(e)` | New | Handle `action: "getConfirmation"` — look up token, return referee data JSON |
| `sendConfirmationEmails()` | New | Generate tokens, write to sheet, send emails via MailApp |
| `closeConfirmations()` | New | Mark remaining Pending rows as no-response |
| `onOpen()` | New | Add custom menu items |
| `VALID_DISTRICTS` | Existing | No change |

**Deployment:** Script changes require a new version deployment. The `/exec` URL stays the same. The HTML file's `SHEET_URL` constant does not change.

### Modified Google Sheet

| Change | Detail |
|--------|--------|
| Add columns R–Y | 8 new columns for confirmation tracking |
| Column headers must be added manually | Or by a one-time setup script |

---

## Component Boundaries

```
+---------------------------+        +--------------------------------+
|      GitHub Pages         |        |      Google Apps Script        |
|                           |        |                                |
|  spring-state-cup-        |  POST  |  doPost(e)                     |
|  nomination.html    ------>------->|    action: (none/nominate)     |
|                           |        |    → append row to sheet       |
|                           |        |                                |
|  confirm.html       ------>------->|  doGet(e)                      |
|    on load (GET)          |  GET   |    action: getConfirmation     |
|    on submit (POST)  ----->------->|    → return referee JSON       |
|                           |  POST  |                                |
|                           |        |  doPost(e)                     |
|                           |        |    action: submitConfirmation  |
|                           |        |    → update sheet row          |
+---------------------------+        +--------------------------------+
                                               |
                                               | read/write
                                               v
                                     +--------------------+
                                     |   Google Sheet     |
                                     |                    |
                                     |  Cols A–Q: nomination data (existing)
                                     |  Cols R–Y: confirmation data (new)
                                     +--------------------+
                                               ^
                                               | read/write (direct, no HTTP)
                                     +--------------------+
                                     |  Apps Script       |
                                     |  Menu Functions    |
                                     |                    |
                                     |  onOpen()          |
                                     |  sendConfirmation  |
                                     |  Emails()          |
                                     |  closeConfirmations|
                                     +--------------------+
```

---

## Architecture Patterns to Follow

### Pattern 1: Action-Based Routing in doPost / doGet

Apps Script has no path routing. Use an `action` field in request body (POST) or query parameter (GET) as the discriminator. Keep each action's logic in its own named function; the handler delegates:

```javascript
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  if (data.action === 'submitConfirmation') return handleConfirmationSubmit(data);
  return handleNomination(data); // existing logic, extracted to function
}

function doGet(e) {
  var action = e.parameter.action;
  if (action === 'getConfirmation') return handleGetConfirmation(e.parameter);
  return jsonError('Unknown action');
}
```

This keeps the existing nomination code intact and isolated.

### Pattern 2: Token Lookup by Column Scan

With 50-100 rows, a full column scan is fast enough. Read all values once per request to minimize Sheets API calls:

```javascript
function findRowByToken(sheet, token) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {  // skip header row
    if (data[i][17] === token) {  // col R = index 17 (0-based)
      return { rowIndex: i + 1, rowData: data[i] }; // 1-based for sheet ops
    }
  }
  return null;
}
```

### Pattern 3: Idempotent Confirmation Writes

Before writing confirmation data, check current status. If status is already "Confirmed", return success without overwriting (referees may click the link again by accident):

```javascript
if (rowData[18] === 'Confirmed') {  // col S = index 18
  return jsonOk({ alreadyConfirmed: true });
}
```

### Pattern 4: Confirmation Page State Machine

`confirm.html` should handle four distinct states based on the GET response:

```
State 1: Loading      — spinner while fetching referee data
State 2: Form         — pre-filled form, referee can edit and submit
State 3: Already Done — "You confirmed on [date]" — no form shown
State 4: Error        — invalid/expired token, or missing email
State 5: Success      — post-submit thank-you message
```

Only one state is visible at a time. Show/hide via CSS class or `display` property, same pattern as the nomination form's `.status.ok` / `.status.er` elements.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Overwriting DRA Nomination Data

Do not write referee confirmation data into columns M, N, O (DRA's original availability and hotel entries). Write to separate columns V, W, X. The DRA's data is the source of record for what was nominated; the referee's data is their own confirmation. The assignor needs both.

### Anti-Pattern 2: Deploying a New Apps Script Web App

Do not create a new web app deployment for the confirmation system. Add functions to the existing script project and redeploy as a new version. Creating a second deployment means maintaining two URLs, updating both in HTML files, and doubling the confusion.

### Anti-Pattern 3: Fetching Referee Data on Every Keystroke

The confirmation page fetches data once on load with the token. It does not call Apps Script again until the referee submits. Do not poll or re-fetch. The pre-filled form values live in the DOM after the initial GET.

### Anti-Pattern 4: Using Row Number as Token

Row number is guessable and changes if rows are inserted or deleted. Use `Utilities.getUuid()` for tokens. Do not use referee email or name — they are guessable and could expose other referees' confirmation pages.

### Anti-Pattern 5: Sending All Emails in a Single Loop Without Error Handling

If MailApp fails mid-batch (quota exceeded, invalid address), the loop stops and only some emails are sent. Wrap each send in try/catch, log failures, and continue. Report both sent and failed counts to the assignor via the UI alert.

---

## Build Order

The confirmation system has clear dependencies. Build in this order:

### Step 1: Sheet Columns (prerequisite for everything)

Add columns R–Y to the Google Sheet with correct headers. This must happen before any Apps Script code can write to them. Low risk — purely additive.

```
R: Confirmation Token
S: Confirmation Status
T: Confirmation Sent At
U: Confirmed At
V: Ref: Availability
W: Ref: Hotel Wk1
X: Ref: Hotel Wk2
Y: Ref: Notes
```

### Step 2: Apps Script — doGet (enables page to load data)

Add `doGet(e)` with `getConfirmation` action. This is prerequisite for `confirm.html` to work at all. Test by calling the deployed URL directly in browser with `?action=getConfirmation&token=TEST` — should return a JSON error for unknown token.

Redeploy script as new version after adding this function.

### Step 3: Apps Script — doPost confirmation action (enables form submission)

Extend `doPost(e)` with `action: "submitConfirmation"` routing. This can be built and tested independently from email sending — test by POSTing directly with a valid token written manually into the sheet.

Redeploy after adding this handler.

### Step 4: confirm.html (GitHub Pages static file)

Build the confirmation page. It depends on Steps 2 and 3 being deployed and working. The page should handle all five states (loading, form, already-done, error, success). Style to match the nomination form.

Test the full GET → form → POST → success flow before proceeding.

### Step 5: Apps Script — sendConfirmationEmails() and onOpen() menu

Build the email-sending function and custom menu. This is the trigger mechanism and depends on the confirmation page URL (from Step 4) being finalised. The email body includes the `confirm.html` link.

Test with a small subset (one row with a real email address) before running against the full sheet.

### Step 6: Apps Script — closeConfirmations()

The cleanup function. Low risk, low priority. Can be added alongside Step 5 or after initial testing.

### Summary Build Order

```
1. Sheet columns (R–Y)
2. Apps Script: doGet → getConfirmation
3. Apps Script: doPost → submitConfirmation
4. confirm.html (GitHub Pages)
5. Apps Script: sendConfirmationEmails() + onOpen() menu
6. Apps Script: closeConfirmations()
```

Steps 2 and 3 can be done in the same script edit and deployed together. Steps 5 and 6 can similarly be combined in one deployment.

---

## Scalability Considerations

| Concern | At 50-100 referees (current) | If scale grows |
|---------|------------------------------|----------------|
| Email quota | MailApp: 100 emails/day (free Google accounts); 1,500/day (Google Workspace) — 50-100 referees is within quota for a single batch | Use GmailApp if higher quota needed |
| Sheet scan for token | Full column scan, O(n) — negligible at 100 rows | Add token index column or use VLOOKUP if >1000 rows |
| Concurrent confirmation submits | Sheets race conditions possible if two requests write to same row simultaneously — extremely unlikely with 50-100 refs | Use LockService if needed |
| Apps Script execution time | 6 min max per execution — batch of 100 emails is well within limits | Split into batches with triggers if needed |

Note on MailApp quota: The 100/day limit applies to personal Google accounts. If the project uses a Google Workspace (formerly G Suite) account (which `tnsoccer.org` likely is), the quota is 1,500 emails/day — well above what's needed. Confidence: MEDIUM (quota numbers are from training data; verify against current Google quotas before relying on them for edge cases).

---

## Key Integration Points Summary

| Integration Point | What Changes | Risk |
|-------------------|-------------|------|
| Apps Script `/exec` URL | Unchanged — same URL used for GET and POST | Low |
| `doPost(e)` | Add action-based routing branch; existing nomination code untouched | Low |
| `doGet(e)` | New function — does not affect existing POST behavior | Low |
| Google Sheet | Additive only — new columns R–Y appended | Low |
| `spring-state-cup-nomination.html` | No changes | None |
| New `confirm.html` | New file, standalone | Medium (new development) |
| Apps Script menu functions | New functions, `onOpen()` trigger | Low |

The existing nomination flow is fully insulated from the confirmation system changes. The only shared resource is the Google Sheet (which receives new columns) and the Apps Script deployment (which receives new functions). Neither change touches existing data or existing function logic.

---

## Confidence Assessment

| Area | Level | Basis |
|------|-------|-------|
| doGet + doPost coexistence | HIGH | Core Apps Script platform feature, well-established |
| CORS behavior (JSON via ContentService) | HIGH | Confirmed working by existing nomination form |
| Custom menu via onOpen() | HIGH | Core Apps Script feature |
| MailApp for sending confirmation emails | HIGH | Core Apps Script feature; exists in SETUP-INSTRUCTIONS.txt already |
| Token generation via Utilities.getUuid() | HIGH | Standard Apps Script utility |
| Email quota limits (100/day free, 1500/day Workspace) | MEDIUM | Training data — verify against current Google documentation |
| Sheet column indexing (0-based in getValues()) | HIGH | Standard JavaScript array behavior |
| Race conditions in sheet writes | LOW | Theoretical concern; at 50-100 users and manual confirmation, extremely unlikely in practice |
