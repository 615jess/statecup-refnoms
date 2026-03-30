# Phase 6: Admin Email Enhancements - Research

**Researched:** 2026-03-30
**Domain:** Static HTML (admin.html) — filter control and BCC mailto link additions; no backend changes required
**Confidence:** HIGH — all patterns already proven in this project; no new libraries or architecture needed

## Summary

Phase 6 adds two UI features to the existing `admin.html` page:

1. **"Not Sent" filter** (ADMIN-01): A toggle that limits the nominee table to show only referees with Status = "Not Sent", making it easy to identify who still needs an initial email without scrolling through the full list.

2. **BCC reminder mailto link** (ADMIN-02, ADMIN-03): A single clickable link that opens Outlook pre-addressed to all referees with Status = "Sent" (emailed but not yet responded), with a pre-filled generic follow-up subject and body — no per-recipient personalization, no token links.

Both features are pure `admin.html` JavaScript changes. No `adminemail.gs` changes are required — the backend already returns all data needed (`status`, `refEmail`, `firstName`, `lastName`). The existing `allNominees` array and `renderTable()` function provide the exact hooks needed.

The only meaningful technical question is the BCC mailto URL length. At approximately 30 referees with average email addresses of ~25 chars each, the BCC recipient list alone is ~750 characters. With subject and body, the total mailto URL will be well within the 8192-character limit documented for Microsoft 365 Outlook. Length is not a practical concern for this use case.

**Primary recommendation:** Both features are additions to existing `admin.html` JavaScript state — add a `statusFilter` state variable (default `''`, set to `'Not Sent'` by a filter button), update `renderTable()` to apply it alongside the existing search filter, and add a BCC mailto link section rendered dynamically from `allNominees` after table load. No backend work needed.

## Standard Stack

Phase 6 uses only what already exists in this project:

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Vanilla JS (existing in admin.html) | N/A | Filter state, BCC URL construction, renderTable update | Matches all existing admin.html patterns; no library warranted for this complexity level |
| CSS variables (existing design system) | N/A | Button styling, section styling | Same `--navy`, `--red`, `--gold`, `--border`, etc. already defined in admin.html |
| `encodeURIComponent()` | Browser built-in | Encode BCC list, subject, body in mailto URL | Same function used by existing `buildMailtoHref()` in admin.html line 527-529 |

### No new libraries needed
| Instead of | Could Use | Verdict |
|------------|-----------|---------|
| Vanilla JS filter | External table filter plugin | Plugin adds CDN dependency for ~5 lines of code. Reject. |
| Dynamic `<a>` construction | Template literals | IE irrelevant here; use string concatenation matching existing admin.html style |

**Installation:** None. Phase 6 is HTML/JS edits only.

## Architecture Patterns

### Recommended File Structure

Only one file changes:
```
admin.html    # Modified — add filter button, BCC mailto section, update renderTable()
```

`adminemail.gs` — no changes needed. The backend already provides all required data.

### Pattern 1: Status Filter State Variable

**What:** Add a `statusFilter` variable alongside the existing `sortState` and `searchQuery` state. A filter button toggles it between `''` (show all) and `'Not Sent'` (show only Not Sent).

**Where to add it:** In the STATE section of admin.html (around line 267-268), alongside existing state vars.

**Example:**
```javascript
// Source: mirrors existing searchQuery pattern in admin.html
var statusFilter = ''; // '' = show all; 'Not Sent' = show only Not Sent referees
```

### Pattern 2: Filter Button (Toggle)

**What:** A button near the search box that activates/deactivates the "Not Sent only" filter. When active, it shows a filled/highlighted state using the existing `--navy` button style. When inactive, it looks like a secondary/outline button.

**When to use:** Rendered once in the `state-content` div, above or alongside the existing search input. A single button is clearer than a dropdown for a two-state toggle.

**Example (HTML):**
```html
<!-- In the search-wrap div, alongside the existing #search input -->
<button id="btn-filter-not-sent" class="btn-filter" onclick="toggleNotSentFilter()">
  Show Not Sent Only
</button>
```

**Example (CSS — add to admin.html style block):**
```css
/* Filter toggle button — inactive state */
.btn-filter {
  background: var(--white);
  border: 1.5px solid var(--border);
  border-radius: var(--r);
  color: var(--navy);
  font-family: 'Open Sans', sans-serif;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  padding: 8px 16px;
  cursor: pointer;
  transition: all .18s;
  white-space: nowrap;
  min-height: 36px;
}
.btn-filter:hover { border-color: var(--navy); }

/* Active state: filled navy, mirrors .btn-email */
.btn-filter.active {
  background: var(--navy);
  border-color: var(--navy);
  color: #fff;
}
```

**Example (JS — toggle function):**
```javascript
// Source: pattern mirrors searchQuery handler in admin.html DOMContentLoaded block
function toggleNotSentFilter() {
  statusFilter = (statusFilter === 'Not Sent') ? '' : 'Not Sent';
  var btn = document.getElementById('btn-filter-not-sent');
  if (statusFilter === 'Not Sent') {
    btn.classList.add('active');
    btn.textContent = 'Not Sent Only \u2713';
  } else {
    btn.classList.remove('active');
    btn.textContent = 'Show Not Sent Only';
  }
  renderTable();
}
```

### Pattern 3: renderTable() — Apply statusFilter

**What:** Add a status filter step to the existing `renderTable()` function. It applies after the existing `searchQuery` filter, so both filters can be active simultaneously.

**Where:** In `renderTable()`, after the existing `if (searchQuery)` filter block (around line 384-390 of current admin.html).

**Example:**
```javascript
// Source: mirrors existing searchQuery filter in renderTable() — admin.html line 384
// Apply status filter (if active)
if (statusFilter) {
  filtered = filtered.filter(function(n) {
    return (n.status || 'Not Sent') === statusFilter;
  });
}
```

**Important:** The status default fallback `|| 'Not Sent'` is already used in the existing row render logic (line 427: `var status = n.status || 'Not Sent'`). Apply the same convention here.

### Pattern 4: BCC Reminder Mailto Link

**What:** After the nominee table section, add a "Reminder Email" section that renders a single `<a href="mailto:...?bcc=...">` link addressed to all `status === 'Sent'` referees, with a pre-filled generic subject and body.

**Why a static `<a>` link, not a button with `window.location.href`:** No API call is needed (no backend state change). Unlike the per-row "Send Email" buttons which call `markSent` to update the sheet, the BCC reminder is read-only — the assignor sends a follow-up but the status remains "Sent" in the sheet until the referee confirms. A plain `<a>` tag is simpler and correct.

**Placement:** Below the `.table-wrap` div, inside the `#state-content` div. Can be a new `.sec-head` + panel section.

**BCC syntax:** The `mailto:` protocol supports `bcc=email1,email2,...` for bulk blind-carbon-copy. All recipient emails go in the `bcc` parameter, the `to` field is left empty or set to the assignor's own email.

**Example (HTML — rendered by JS after data loads):**
```html
<!-- Rendered dynamically by renderBccReminder() after loadNominees completes -->
<div id="bcc-reminder-section" style="margin-top: 32px;"></div>
```

**Example (JS — build and render the BCC mailto):**
```javascript
// Source: mirrors buildMailtoHref() in admin.html lines 475-529; no new patterns
function renderBccReminder(nominees, props) {
  var sentEmails = nominees
    .filter(function(n) { return (n.status || 'Not Sent') === 'Sent'; })
    .map(function(n) { return n.refEmail; })
    .filter(function(e) { return e; }); // exclude blank emails

  var section = document.getElementById('bcc-reminder-section');

  if (sentEmails.length === 0) {
    section.innerHTML =
      '<div class="sec-head"><h2>Reminder Email</h2></div>' +
      '<p style="color:var(--muted);font-size:13px;">No referees with \u201cSent\u201d status. ' +
      'Reminder link will appear here once initial emails have been sent.</p>';
    return;
  }

  var bccList  = sentEmails.join(',');
  var subject  = 'Spring State Cup 2026 \u2014 Reminder: Response Needed';
  var assignorEmail = props.assignorEmail || '';

  var bodyLines = [
    'Dear Referee,',
    '',
    'This is a friendly reminder that we have not yet received your response to the ' +
    'Spring State Cup 2026 referee nomination.',
    '',
    'Please check your email for a message with the subject "Spring State Cup 2026 ' +
    '\u2014 Referee Nomination" and use your personalized link to confirm your availability.',
    ''
  ];

  if (assignorEmail) {
    bodyLines.push('Questions? Please contact:');
    bodyLines.push('  Jess Erickson, State Cup Assignor');
    bodyLines.push('  ' + assignorEmail);
    bodyLines.push('');
  }

  bodyLines.push('Thank you,');
  bodyLines.push('Jess Erickson');
  bodyLines.push('State Cup Assignor');
  bodyLines.push('Tennessee Soccer Referee Program');

  var body = bodyLines.join('\r\n');

  var href = 'mailto:' +
    '?bcc='     + encodeURIComponent(bccList) +
    '&subject=' + encodeURIComponent(subject) +
    '&body='    + encodeURIComponent(body);

  section.innerHTML =
    '<div class="sec-head" style="margin-top:32px;"><h2>Reminder Email</h2></div>' +
    '<div style="background:var(--white);border:1px solid var(--border);border-radius:var(--r);padding:16px 20px;">' +
      '<p style="font-size:13px;color:var(--muted);margin-bottom:12px;">' +
        sentEmails.length + ' referee' + (sentEmails.length === 1 ? '' : 's') +
        ' emailed but not yet confirmed. ' +
        'Opens Outlook with all recipients in BCC.' +
      '</p>' +
      '<a href="' + escAttr(href) + '" class="btn-email" style="display:inline-block;text-decoration:none;">' +
        'Open Reminder Email in Outlook' +
      '</a>' +
    '</div>';
}
```

**Call site:** Call `renderBccReminder(allNominees, tournamentProps)` at the end of `loadNominees()`, after `renderSummary()` and `renderTable()` are called. Also call it at the end of `updateRowStatus()` so the count updates when a referee confirms (status changes from Sent to Confirmed via page refresh or real-time update).

**Note on `to:` field:** Leave the `to` field empty (`mailto:?bcc=...`). Some mail clients require something in `to` — if testing reveals Outlook won't open without a `to` value, set `to` to the assignor's own email address (`mailto:assignor@example.com?bcc=...`). The assignor email is available via `tournamentProps.assignorEmail`.

### Pattern 5: Using Existing escAttr() for Mailto Attribute

The existing `escAttr()` function (admin.html line 626) already handles attribute escaping. Use it when setting `href` inside an innerHTML string — same as the existing `data-mailto-href` attribute pattern on lines 454-455.

### Anti-Patterns to Avoid

- **Adding a new backend endpoint for Phase 6:** Not needed. All data is already returned by `getAllNominees`. Adding a backend-only `getSentEmails` action would add deployment complexity for zero benefit.
- **Generating the BCC mailto URL server-side:** The `href` must be constructed client-side (like existing `buildMailtoHref`) so it can reflect the live state of `allNominees` without another fetch round-trip.
- **Setting `to:` field to all Sent recipients instead of `bcc:`:** Would expose all referee email addresses to each other. Use BCC.
- **Calling `renderBccReminder()` inside `renderTable()`:** `renderTable()` is called on every sort and search event. Rebuilding the BCC href on every keystroke is unnecessary. Render it once after load and after any status change.
- **Blocking the BCC link on `statusFilter` state:** The BCC reminder section is independent of the Not Sent filter. Even when the filter is active (showing only Not Sent rows), the reminder section should still show the count/link for Sent referees.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collecting Sent email addresses | New fetch / new endpoint | Filter `allNominees` array already in memory | Data is already loaded; a new API call adds latency and deployment complexity |
| Attribute escaping in innerHTML | Custom escape | `escAttr()` already in admin.html line 626 | Identical pattern to the existing `data-mailto-href` attribute escape on line 454 |
| HTML-escaping text nodes | Custom escape | `esc()` already in admin.html line 617 | Use the existing helper |
| Filter UI state management | External state library | `var statusFilter = ''` variable + `renderTable()` call | The existing `searchQuery` + `renderTable()` pattern is the exact model |

**Key insight:** Phase 6 adds UI state (a filter toggle and a dynamic link section) on top of data that is already in memory. Both features are pure client-side additions with no new architecture needed.

## Common Pitfalls

### Pitfall 1: BCC Mailto URL Length with Many Recipients

**What goes wrong:** If the tournament has many nominees all still at "Sent" status (e.g., 80+ referees with no responses), the BCC list could grow long.
**Why it happens:** Each email is ~20-30 chars; 80 emails = ~2000 chars in the BCC segment alone. After `encodeURIComponent` encoding (commas become `%2C`), the list grows further.
**How to avoid:** Calculate: 80 emails × 30 chars = 2400 raw chars. After encoding commas (`,` → `%2C`), adds ~160 chars. Plus subject (~60 encoded chars) and body (~500 encoded chars) = ~3100 total. Well under the 8192-char limit documented for Microsoft 365 Outlook desktop.
**Warning signs:** Outlook opens with the BCC field truncated, or refuses to open the mailto link entirely. If this happens (unlikely at expected scale), the fallback is to display the email list as copyable text rather than a direct mailto link.

### Pitfall 2: Filter State Not Cleared on Page Reload Data

**What goes wrong:** If `statusFilter = 'Not Sent'` is active and the assignor hits retry after an error, or if data reloads, the filter stays active and the table appears empty after a full re-render because no rows match.
**Why it happens:** `statusFilter` is a module-level variable that persists across `renderTable()` calls. On initial load it defaults to `''`, so this is only an issue if a hard page refresh occurs mid-session with the filter active — in practice not a problem since `statusFilter` resets on page load.
**How to avoid:** No action needed — `var statusFilter = ''` at module scope means every hard refresh resets it. Document this behavior in the plan for awareness.

### Pitfall 3: Sent Count in BCC Section Diverges from Table After Filter

**What goes wrong:** The BCC section always shows the full count of Sent referees from `allNominees`. If the filter is active (showing only Not Sent rows), the table has 0 visible rows but the BCC section still shows "12 referees emailed." This could confuse the assignor.
**Why it happens:** The BCC section is built from `allNominees` (all data), not from the filtered table view.
**How to avoid:** This is actually correct behavior — the assignor should see the BCC reminder regardless of which filter view they're in. The section label "Reminder Email" makes its purpose clear. No fix needed; confirm the design intent in the plan.

### Pitfall 4: Mailto BCC with Empty Email Values

**What goes wrong:** If any nominee in `allNominees` has `status === 'Sent'` but an empty `refEmail` (data entry error in sheet), `encodeURIComponent('')` would insert an empty string in the BCC list, producing `mailto:?bcc=email1,,email3`. Outlook may reject or mis-parse this.
**Why it happens:** The backend returns `String(r[7] || '')` for `refEmail` — blank is possible if a DRA submitted without an email.
**How to avoid:** Filter out blank emails before building the BCC list. The code example above includes `.filter(function(e) { return e; })` for exactly this reason.

### Pitfall 5: Apps Script Redeployment (Phase 6 Does Not Require It)

**What goes wrong:** Planner or executor thinks Phase 6 requires a new Apps Script deployment.
**Why it happens:** Prior phases required new deployments after `.gs` file changes.
**How to avoid:** Phase 6 makes no `.gs` changes. The existing `getAllNominees` endpoint already returns `status` and `refEmail` for all nominees. No redeployment needed. The `SCRIPT_URL` in `admin.html` stays unchanged.

## Code Examples

### Updating renderTable() to Apply Status Filter

```javascript
// Source: mirrors existing searchQuery filter at admin.html line 384-390
// Insert AFTER the searchQuery filter block, BEFORE the header sort indicators update

// Apply status filter (if active)
if (statusFilter) {
  filtered = filtered.filter(function(n) {
    return (n.status || 'Not Sent') === statusFilter;
  });
}
```

### Updating loadNominees() to Render BCC Section

```javascript
// Source: mirrors renderSummary() and renderTable() call sequence in loadNominees()
// admin.html lines 299-302 — add renderBccReminder call after renderTable()
allNominees = data.nominees || [];
tournamentProps = data.props || {};
renderSummary(allNominees);
renderTable();
renderBccReminder(allNominees, tournamentProps);  // NEW — Phase 6
showState('content');
```

### Updating updateRowStatus() to Refresh BCC Count

```javascript
// Source: mirrors renderSummary(allNominees) call at admin.html line 597
// After updating allNominees[i].status in updateRowStatus(), add:
renderBccReminder(allNominees, tournamentProps);  // NEW — Phase 6
```

### BCC Mailto URL Structure

```javascript
// mailto with empty To, BCC list, pre-filled subject and body
// Source: standard mailto RFC 6068 syntax — verified against existing buildMailtoHref() pattern
'mailto:' +
'?bcc='     + encodeURIComponent('email1@example.com,email2@example.com') +
'&subject=' + encodeURIComponent('Spring State Cup 2026 \u2014 Reminder: Response Needed') +
'&body='    + encodeURIComponent('Dear Referee,\r\n\r\nThis is a reminder...')
```

### Filter Button HTML Placement

Place the filter button in the `.search-wrap` div, after the existing `#search` input, styled to align inline with it:

```html
<div class="search-wrap" style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
  <input type="text" id="search" placeholder="Search by name or email&hellip;" autocomplete="off">
  <button id="btn-filter-not-sent" class="btn-filter" onclick="toggleNotSentFilter()">
    Show Not Sent Only
  </button>
</div>
```

Note: The existing `search-wrap` CSS sets `margin-bottom: 12px` with no flex display. Adding `style="display:flex..."` inline keeps backward compatibility without changing the shared CSS class.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Table shows all nominees always | Toggle filter for Not Sent subset | Phase 6 (now) | Assignor can quickly see who hasn't been emailed yet |
| No bulk reminder mechanism | BCC mailto for all Sent-status referees | Phase 6 (now) | One click opens a reminder to all non-responders |

**Confirmed not deprecated for this phase:**
- `SCRIPT_URL` in admin.html: unchanged, no redeployment needed
- Existing `buildMailtoHref()` function: unchanged, continues to serve per-row email buttons
- Existing `renderSummary()`, `sortNominees()`, `renderTable()`: unchanged except for adding the `statusFilter` step inside `renderTable()`

## Open Questions

1. **`to:` field in BCC mailto — empty vs. assignor's own email**
   - What we know: `mailto:?bcc=...` (empty `to`) is valid per RFC 6068 and works in most clients.
   - What's unclear: Whether New Outlook (Microsoft 365 web-app shell) accepts an empty `to` field or silently drops the mailto link.
   - Recommendation: Start with empty `to`. If testing shows Outlook won't open the compose window, add `to: tournamentProps.assignorEmail` (already available in `tournamentProps`).

2. **BCC section visibility when zero Sent referees exist**
   - What we know: During early use (before any emails are sent), all referees are "Not Sent" — the BCC section would show the empty-state message.
   - What's unclear: Whether to hide the section entirely until at least one referee is Sent, or always show it with the empty-state message.
   - Recommendation: Always show the section with an informative empty-state message. Hiding it entirely could make the assignor think the feature is broken.

3. **Whether `renderBccReminder()` should re-run after `updateRowStatus()`**
   - What we know: `updateRowStatus()` is called when a referee is marked Sent via the individual email button. At that point, the BCC count should increase by 1.
   - What's unclear: The current flow only marks someone as Sent (Not Sent → Sent); Confirmed transitions happen only when the referee submits their form (server-side, detected on page reload). So `updateRowStatus()` only ever moves a referee from Not Sent to Sent.
   - Recommendation: Yes, call `renderBccReminder(allNominees, tournamentProps)` at the end of `updateRowStatus()` — the count will increase each time the assignor sends an initial email during the current session.

## Sources

### Primary (HIGH confidence)
- `admin.html` (this project, current) — full source read; all state variables, filter logic hook points, `renderTable()`, `buildMailtoHref()`, `updateRowStatus()`, `escAttr()`, CSS design system
- `scripts/adminemail.gs` (this project, current) — confirmed `getAllNominees` already returns `status` and `refEmail`; no changes needed
- `.planning/COLUMN-MAP.md` (this project) — status values (Not Sent / Sent / Confirmed) and their exact string values
- `.planning/phases/04-email-admin-page/04-RESEARCH.md` (this project) — mailto URL length limits already researched (8192-char limit for M365 Outlook)

### Secondary (MEDIUM confidence)
- [Microsoft Q&A — BCC recipient limits in Outlook](https://learn.microsoft.com/en-us/answers/questions/4630847/how-many-recipents-can-i-add-into-bcc-field-in-out) — 500 recipients max per send (not a concern at this scale)
- [Microsoft Q&A — Outlook URL limit increased to 8192](https://learn.microsoft.com/en-us/answers/questions/1063670/outlook-for-microsoft-365-truncating-long-urls) — confirmed M365 desktop increased from 2084 to 8192 chars

### Tertiary (LOW confidence — noted for awareness)
- [Growing with the Web — mailto character limit workarounds](https://www.growingwiththeweb.com/2012/07/getting-around-mailto-character-limit.html) — older article; 8192-char limit per M365 docs supersedes older 2000-char guidance

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new tools; pure additions to existing admin.html
- Architecture (filter state pattern): HIGH — directly mirrors `searchQuery` + `renderTable()` already in admin.html
- Architecture (BCC mailto): HIGH — mirrors `buildMailtoHref()` already in admin.html; only adds `bcc=` parameter
- BCC URL length: HIGH — at expected scale (~30-50 Sent referees), total URL well under 8192-char M365 limit
- Empty `to:` field behavior in New Outlook: MEDIUM — RFC valid but New Outlook behavior unverified
- No backend changes required: HIGH — `getAllNominees` already returns status + refEmail

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable domain; admin.html and Apps Script patterns are production-proven)
