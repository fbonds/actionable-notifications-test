# TTAHUB Actionable Notifications — Manual Test Plan DRAFT

> This is the complete, self-contained test plan: scope, approach, setup,
> execution flow, the local-Docker runbook for time-driven specs, and the full
> 174-row test matrix are all in this one document. Paste it into a single
> Confluence page.

## Scope

This plan covers all in-app and email notifications defined in the
*TTA Hub Notifications* spec sheet — **174 distinct variations** across six
categories:

| Category | In-app | Email | Total |
|---|---:|---:|---:|
| Activity Report | 24 | 30 | 54 |
| Collaboration Report | 21 | 29 | 50 |
| Training Report | 17 | 36 | 53 |
| Communication Log | 2 | 4 | 6 |
| Other (groups, monitoring) | 4 | 4 | 8 |
| System (outages) | 1 | 2 | 3 |
| **Total** | **69** | **105** | **174** |

In scope for this round: all rows with status **Proposed** or **Published**
(≈150). Out of scope: rows marked **Out of scope** (6) and **Paused** TR
reminders (18) — re-evaluate when status changes.

This plan and the matrix verify that the **correct notification fires with
the right recipient, channel, cadence, and content.** Confirming that a
notification is correctly *suppressed* (opt-outs, non-delivery), along with
error and edge states, is **out of scope** here.

## Approach

Two complementary layers:

1. **Log inspection — bulk (~150 variations; the source of truth).** In lower
   environments emails are not actually sent — the dispatch *decision* is
   logged. Trigger each scenario in the UI, then read the Cloud Foundry app
   logs via the `cf` CLI to confirm the right event fired. Details in
   *Reading the logs* below.
2. **Spot-check real delivery (~11 messages per release).** Send to owned
   Gmail/Outlook inboxes to catch rendering and deliverability regressions
   that logs cannot (logs carry no subject/recipient). See
   *Per-release spot-check*.

## Reading the logs

### Access

```
cf login --sso
cf logs <environment under test> --recent   # dump recent buffer, then exit
cf logs <environment under test>            # tail live
cf apps                                      # find the worker app (mailer runs there)
```

Prefer the read-only `cf` commands. `cf` CLI v8 is assumed
(`brew install cloudfoundry/tap/cf-cli@8`); log in via cloud.gov SSO
(`cf login --sso -a api.fr.cloud.gov`).

### Environments (`<environment under test>`)

Pick the app name matching the build under test; the commands are identical for
all:

| App name | Use |
|---|---|
| `tta-smarthub-staging` | Staging; release-candidate polishing / final bug-hunt |
| `tta-smarthub-dev-blue` | The dev leading **this** release — tail this for the redesign's events |
| `tta-smarthub-dev-gold` | Per-developer env |
| `tta-smarthub-dev-green` | Per-developer env (notification captures to date used this one) |
| `tta-smarthub-dev-pink` | Per-developer env |
| `tta-smarthub-dev-red` | Per-developer env |

The five color-named `dev-*` apps are per-developer environments (each dev is
assigned one). When to use which for this feature:

- **Inter-sprint check-ins** → the assigned dev's color (currently
  `tta-smarthub-dev-blue`).
- **End-to-end / time-driven testing** → local Docker (see *Time-driven
  triggers*).
- **Release candidates** → a dev color **or** `tta-smarthub-staging`.

### Log shape

Winston JSON lines prefixed by a CF source tag (`[APP/PROC/WEB/0]`,
`[RTR/n]`, `[APP/PROC/WORKER/0]`), with fields `level`, `message` (free
text), `timestamp`, and a `label` taxonomy (`AUDIT` / `REQUEST` / `RTR`).
There is **no** structured event envelope — checks grep the `message` string.

### Notification lines (email — confirmed with dev, 2026-06-04)

Email jobs run in the **`WORKER`** process (`[APP/PROC/WORKER/0]`) and emit:

| Type | Line |
|---|---|
| **Sent** | `Successfully sent <actionKey> notification for <REPORT-ID>` |
| **Human-readable** | `MAILER: Notifying users that report <REPORT-ID> was approved.` |
| **Suppressed** | `Did not send <actionKey> notification for <REPORT-ID> preferences are not set or marked as "no-send"` |
| **Timing** | `notify<Action> <actionKey> execution time: Nms` |

### What the logs do and don't tell you

- **Decision point.** *Sent* and *suppressed* both log (with reason). A
  "Did not send … no-send" means the recipient's prefs are off (see
  *Preconditions*) — expected, not a failure.
- **No recipient / subject / channel / cadence in the log** — confirm those
  via the spot-check inbox.
- **Grep handle:** the report **`displayId`** (isolates all activity for the
  report under test) and/or the action key (e.g. `changesRequested`,
  `collaboratorAssigned`, `approverAssigned`, `reportApproved`, and the
  `trainingReport*` / `*Digest` variants). One action key can map to several
  matrix rows.
- **No remote trigger** for scheduled/digest notifications — local only (see
  *Time-driven triggers*).
- **In-app notifications don't appear here** — they're rows in the
  `Notifications` table; verify via the notification center (see
  *Two subsystems*).
- Logs may contain session cookies/tokens in request dumps — treat log
  exports as sensitive.

## How we test the three core questions

| Question | Approach |
|---|---|
| **How do we test emails?** | Bulk: `cf logs` grep against the dispatch event. Spot-check: owned inboxes via the per-release checklist. |
| **How do we handle roles, approvers, etc.?** | **One login (your own) + the admin tool.** For any other party a scenario needs, use the admin tool to set that user's role / region / permissions / email and to **impersonate** them for their trigger (or self-serve where the flow allows). No second human or shared login. Full mechanics in *Test data & environment refresh* and *Preconditions*. |
| **How do we test email verification (arrival / rendering)?** | Covered by the spot-check checklist — testers visually inspect subject, body, links, and CTA in the actual inbox for the curated subset. Not attempted for the full 174. |

## Two subsystems (different verification surfaces)

Per the build spike (TTAHUB-5339 + follow-ons), notifications split into two
subsystems with different verification surfaces:

- **Email** → the existing mailer; verify in **`cf` worker logs** (action
  keys / `Successfully sent …`).
- **In-app** → a new **`Notifications` DB table** behind the feature flag
  **`actionable_notifications`**; verify in the **notification center UI**
  (or query the table). The table stores `userId` (recipient), `type`,
  `text`, `link`, `viewedAt`, `archivedAt` — so in-app rows *can* verify
  recipient/content, unlike email logs. Each matrix row's in-app `type` is
  filled from `NOTIFICATION_TYPES`; firing is gated by
  `NOTIFICATION_CONFIGURATION` (only 2 types wired so far — see the matrix
  legend).

## Test data & environment refresh

Two modes, depending on environment:

- **Local** — production data is imported directly (**no obfuscation**). Drive
  from your own login and use the admin tool to set up / impersonate any other
  party from the real user data.
- **Lowers (dev/staging)** — **obfuscated data that refreshes on weekends**;
  users, internal IDs, emails, grantee data, and report IDs present today are
  **not valid after the refresh**. The shared team logins are off-limits (their
  real owners use them), so other actors are **obfuscated users you provision
  and impersonate via the admin tool** within the pre-reset window.

Either way, the one constant is **your own login**. Consequences baked into the
plan:
- **Never hardcode** internal user IDs, emails, or report `displayId`s — they
  are session-scoped. Capture them fresh during setup; verify against the
  report you create *this session*.
- In the lowers, **re-run setup after each weekend refresh** (≈ Monday).

## Preconditions (re-run per session; in the lowers, after each weekend refresh)

- **In-app:** the **`actionable_notifications` feature flag must be ON** in
  the environment under test (confirm per env).
- **Provision each actor the scenario needs** (recipient, approver, etc.) with
  the **admin tool** — set role / region / permissions, set **email** to an
  inbox you own, and note that user's **current internal id**. Locally these
  are real imported-prod users; in the lowers, obfuscated users.
- **Email sends require the recipient's prefs to allow it** — otherwise the
  worker logs `Did not send … no-send` and nothing fires (expected, not a
  bug). So also ensure the recipient has a **qualifying role** (the
  email-preferences UI only appears for certain roles — e.g. ECM) and set its
  **preferences to send** (default can be off).
- **Drive each party's trigger by impersonating that user** via the admin tool
  (no second login), or self-serve where the flow allows (e.g. add yourself as
  approver).
- **Fixtures:** create the report(s)/relationships the scenario needs at test
  time — don't rely on pre-existing data.

## Per-test execution flow

For each row in the matrix:

1. Start a log tail before triggering, pointed at the **worker** process.
   Grep by the report's display id to catch everything, and/or the row's
   action key — e.g.
   `cf logs <environment under test> | grep -E 'R01-AR-63792|changesRequested'`.
2. Become the *Role (actor)* — impersonate the provisioned user via the
   admin tool (or self-serve where the flow allows).
3. Perform the *Trigger* against a fixture report you created this session.
4. Confirm `Successfully sent <actionKey> notification for <REPORT-ID>`
   appears within ~30 seconds. (A `Did not send … no-send` line means the
   recipient's prefs are off — fix per Preconditions, not a row failure.)
5. Recipient, subject, channel, and cadence are **not** in the logs.
   Confirm *Expected subject / in-app content* and the recipient via the
   **per-release spot-check** (real inbox) for the curated subset — not per
   row here. In-app rows: verify in the notification center.
6. Record Pass/Fail + tester + build in the tracking columns.

## Cross-cutting checks (run once per build, not per spec)

These behaviors apply across all categories and should be on a separate
checklist rather than repeated 174 times:

- **Notification Preferences page** — checkbox + dropdown per row;
  "Set preferences for all..." section toggle propagates both ways;
  unsaved-changes modal fires on back-nav with edits; settings persist
  through save + reload.
- **Notifications page** — Active / Archived tabs; sort by "Action needed
  (oldest first)"; type filter (Activity Report / Training Report /
  Collaboration Report / System Related / Other — note no separate Comm Log
  filter); pagination; CTA links route to correct resource. Confirmed
  mechanics (spike): **user dismiss/mark-read** = `updateNotification`
  (`viewedAt`/`archivedAt`); **system auto-clear** of stale notifications on
  a state change = `deleteNotification` (scoped); **30-day cutoff** = a
  scheduled cleanup job that deletes older notifications; users see **only
  their own**; admins create **global** notifications.
- **Header bell badge count** updates on new active notifications and
  decrements on dismissal.

> Suppression behaviors (opt-out non-delivery, collaborator removed
> mid-flight, dismissal edge cases) are **out of scope** for these checks —
> see the Scope note.

## Time-driven triggers — special handling (local Docker)

These cannot be triggered by a UI action and are run from a **local Docker
stack on the tester's dev box** (the runbook is inlined below):

- TR 20-day "submit event details" reminder + 10-day repeat escalation.
- TR 20-day "submit session details" / "create a session" / "complete
  event" reminders.
- Monthly AR submission-deadline alert (5th working day of month).
- "AR pending approval for X days" alert.
- Monitoring daily digest (per region, only on net-new goals).
- Daily / weekly / monthly digest aggregation jobs.

**Why local.** Dev confirmed there is **no remote mechanism** to fire
scheduled vs immediate notifications on the CF environments —
*"if you want control, you'll need to do it locally."* So these ~30
clock-dependent specs are tested locally, where we can trigger the scheduled
jobs directly (force the cron job to run every minute, or seed reports with
back-dated start/end dates to trip the 20-day reminders) instead of waiting on
the real schedule. Event-driven specs remain on CF `cf logs` per the main
execution flow.

> ⚠️ **Local vs deployed — which process runs the jobs.** Locally, cron /
> `runCronJobs()` runs in the **backend** process (`src/app.js:174`), so watch
> the **backend** container's logs. In deployed (CF) environments the
> notification dispatch is driven from the **worker** process. Same Winston
> lines and action keys, different process — don't mix up which one to watch.

> **Mail rendering bonus.** The local stack includes **Mailpit**, which
> captures the sent mail and doubles as a rendering check for digests/reminders
> without needing real Gmail/Outlook delivery.

### Local Docker setup

The TTADP compose file lives at `docker/compose/docker-compose.yml` (not the
default location), so every `docker compose` command must pass `-f`. Redis is
password-protected (`REDIS_PASS`, defaults to `SUPERSECUREPASSWORD`).

```sh
# from anywhere; -f points at the non-default compose path
DC="docker compose -f docker/compose/docker-compose.yml"

# recreate backend so .env changes take effect (restart is NOT enough)
$DC up -d --force-recreate backend

# flush Redis-stored sessions
$DC exec redis redis-cli -a SUPERSECUREPASSWORD FLUSHALL

# tail digest activity (backend process locally — NOT worker)
$DC logs -f backend | grep -i digest
```

### Switch the logged-in user (local Docker)

Running locally with `BYPASS_AUTH=true`, editing `.env` alone does **not**
switch users — the bypass user gets baked into the Redis-backed session on the
first request and is read *before* the env var on every request after. Three
independent things hold onto the old user:

1. **The session wins over the env var.** `src/services/currentUser.js`
   (`idFromSessionOrLocals`) checks `req.session.userId` first; only an empty
   session falls through to seeding from `CURRENT_USER_ID`. Once seeded, the
   env var is never consulted again.
2. **The session lives in Redis, not the app.** `src/middleware/sessionMiddleware.js`
   uses `RedisStore` (8h TTL) and the `redis-data` volume persists it across
   `docker compose down/up` — an app restart does not clear it.
3. **`docker compose restart` does not re-read `.env`.** Env vars are injected
   at container *creation*. A restart reuses the container with the old
   `CURRENT_USER_ID` baked in.

**Recipe:**

1. Set the new `CURRENT_USER_ID` in `.env`.
2. **Recreate** the backend so it re-reads `.env` (not `restart`):
   `$DC up -d --force-recreate backend`
3. Flush the stored session in Redis:
   `$DC exec redis redis-cli -a SUPERSECUREPASSWORD FLUSHALL`
   (`-a` prints a harmless "using a password ... may not be safe" warning —
   ignore it; expect `OK`.)
4. Clear the browser's `httpOnly` `session` cookie: DevTools →
   **Application → Storage → Clear site data** for `localhost:3000`.
   *(Easiest alternative: just use a fresh Incognito window each time.)*
5. Reload `localhost:3000`.

**Verify:** `$DC exec backend printenv CURRENT_USER_ID` should print the NEW
id. If it still prints the old id, the recreate didn't happen — repeat step 2.

> **Habit that always works:** fresh Incognito window per user (skips cookie
> clearing) + `FLUSHALL` whenever the user won't switch. That covers both
> places the old user is remembered.

### Trigger notification digests on demand (local Docker)

Force the digest to fire every minute instead of waiting for the real 4 PM
schedule. Edit `src/lib/cron.js` and set the **daily** schedule to every
minute:

```js
// Run daily at 4 PM
const dailyDaySched = '1 16 * * 1-5';
// →
const dailyDaySched = '* * * * *';   // every minute — TESTING ONLY
```

Target the **daily** job specifically:
- The daily job is the richest path — runs `digestForSetting` for every
  config, `recipientApprovedDigest`, and (when enabled)
  `trainingReportTaskDueNotifications`.
- **Weekly** is constrained to Fridays and **monthly** early-returns via
  `checkLastDay` unless it's literally the last day of the month, so changing
  their schedules alone won't make them fire.

The backend mounts the repo as a volume and runs `tsx watch`, so this code
edit hot-reloads — **no container recreate needed for the edit itself.**

**Prerequisites:**

- **`FORCE_CRON=true`** must be set (cron only schedules in non-production if
  this is true). It's already in `.env`; confirm it reached the container:
  `$DC exec backend printenv FORCE_CRON` (expect: `true`). If empty/`false`,
  recreate: `$DC up -d --force-recreate backend`.
- `runCronJobs()` runs in the **backend** process (`src/app.js:174`), **not**
  the worker — watch the backend container's logs.

**Watch it fire:** `$DC logs -f backend | grep -i digest`. Expect
`Starting daily digests` / `Completed daily digests` roughly once a minute.

**Where the emails go:**

- Locally, emails are captured by **Mailpit** — check its web UI, not a real
  inbox.
- An **empty digest is normal** and won't send — it depends on there being
  qualifying records and on each user's notification preferences.
- The training-report-due path inside the daily job is gated by
  `SEND_TRAININGREPORTTASKDUENOTIFICATION === 'true'` (`cron.js:79`), which is
  not in `.env` by default — add it if you need to test that path.

> ⚠️ **Cleanup:** **Do not commit the `* * * * *` change** — it is test-only.
> Revert it (or keep it as a commented line locally) before pushing the branch.

## Per-release spot-check (live email delivery)

Run in staging once per release. Goal is rendering and deliverability — not
coverage. Because data is obfuscated, **set the recipient's email to an inbox
you own** (Gmail/Outlook) during setup, then trigger — the email lands in your
inbox. Re-do after each weekend refresh.

| # | Spec | Why it's on the list |
|---|---|---|
| 1 | AR-1b | Add-collaborator — most-trafficked AR event |
| 2 | AR-6b | Approver requests changes — includes interpolated approver name |
| 3 | AR-11 | Daily digest with bullets — verifies aggregation rendering |
| 4 | CR-2b | CR submitted for approval — verifies category swap doesn't break template |
| 5 | TR-3b | TR session submitted — verifies session-name interpolation |
| 6 | TR-13 | TR past-due — verifies reminder/escalation template |
| 7 | CL-1b | Comm Log add — verifies CL template family |
| 8 | Misc-1b | Monitoring new-data alert — verifies recipient-list rendering |
| 9 | Misc-3b | Group shared with me — verifies group-name interpolation |
| 10 | Misc-4b | Planned outage broadcast — verifies all-roles delivery |
| 11 | Weekly digest sample (any AR-12 / CR-12) | Verifies weekly cadence rendering |

For each spot-check item, capture: subject text, sender address,
rendering in Gmail (web + mobile), rendering in Outlook (web), CTA link
resolves to correct TTAHUB resource, plain-text fallback present.

## Known open spec questions (resolve before completion)

These were flagged in the design spreadsheet's Notes column and affect
test interpretation:

1. **Misc-1b** — TTAC/Manager-to-recipient mapping not yet defined. Blocks
   ~10% of the matrix until routing is decided.
2. **CL-2** — "Anyone with a group or just Program Specialists?"
3. **TR-6a** — "Do Collaborating Specialists submit TRs?"
4. **Misc-5a** — Can the unplanned-outage email be sent during an outage?
5. **Dismissal logic** — Can dismissing one notification automatically
   clear logically-related ones, or is dismissal always per-notification?

## Tools & access required

- **`cf` CLI v8** (`brew install cloudfoundry/tap/cf-cli@8`) + cloud.gov
  access to the TTAHUB app (`cf login --sso`), with permission to read
  logs for the environment under test and its worker app in the relevant
  lower env (environment list under *Reading the logs*).
- **Your own HSES login** (e.g. `test.tta.fletcher`) — the one reliable
  identity in every env (the shared team logins are off-limits in the lowers).
- **Admin tool** — to set any user's role / region / permissions / email and
  to **impersonate** them for multi-party triggers.
- **Owned Gmail/Outlook inbox(es)** to point a recipient's email at for the
  spot-check rows.
- **Local** runs against **imported production data** (no obfuscation).
- **Local Docker** (Docker + the TTADP repo) for the time-driven specs — no
  remote trigger exists; runbook under *Time-driven triggers*.

---

# Master test matrix

The 174 specs follow, grouped by category. All six tables share the same
columns:

- **Spec columns** (sourced from the design spreadsheet): ID, Status,
  Channel, Role (actor), Trigger, Received by, Expected subject /
  in-app content, CTA.
- **Verify** column: per row, the in-app `Notifications.type` or the email
  `cf logs … | grep` (action key / report `displayId`).
- **Execution tracking**: Logged-in as, Pass / Fail, Tester, Build, Notes.

### How to read the *Verify* column (per TTAHUB-5383 / PR #3665)

- **In-app** rows → look for a row in the `Notifications` table (or the
  notification center) with the given `type` and the report's `displayId`;
  requires the **`actionable_notifications`** feature flag ON.
- **Email** rows → `cf logs <environment under test> | grep` the action key
  where **wired** (fires today); rows marked *planned* are not in
  `EMAIL_ACTIONS` yet (emails for new types ship later — TTAHUB-5390 +
  per-notification tickets).
- Email logs carry **no recipient/subject** (the table has `userId`); confirm
  those via the per-release spot-check. **Paused** rows are out of scope.
- **In-app firing is gated by `NOTIFICATION_CONFIGURATION`** — as of PR #3673
  only `ACTIVITY_REPORT_NEEDS_ACTION` and `SYSTEM_PLANNED_OUTAGE` are
  configured; other `type`s throw until registered, and a call site must invoke
  `createNotification`. So most in-app rows aren't creatable yet — they light
  up as config + call sites land.

### Placeholders in the *Expected subject / in-app content* column

Bracketed `[…]` values are **substituted at send time** — the real
notification text carries the actual value. They're illustrative, not match
targets: match on the surrounding literal text, and on the report you created
this session (never on a fixed id).

| Placeholder | Substituted with (format / example) |
|---|---|
| `[Report ID]` | The report's display id — `R<region>-AR-<n>` (AR), `R<region>-CR-<n>` (CR), `R<region>-TR-<yy>-<n>` (TR). e.g. `R14-AR-63792` |
| `[Recipient name]` | Grant recipient (grantee) org name |
| `[Activity name]` | The activity a Collaboration Report covers |
| `[Creator's name]`, `[Collaborator's name]`, `[Approver 1 name]`, `[Approver 2 name]` | The relevant user's full name |
| `[Session name]`, `[Event name]` | Training session / event name |
| `[Group name]` | A "My group" name |
| `[daily/weekly/monthly]` | The recipient's chosen digest cadence |
| `[date through date]`, `[day, month, day]` | The outage window date(s) |

## Test Matrix — Activity Reports (54)

| ID | Status | Channel | Role (actor) | Trigger | Received by | Expected subject / in-app content | CTA | Verify (in-app table / email log) | Logged-in as | Pass / Fail | Tester | Build | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|  | Out of scope | In-app | System | Near report submission deadline (5th working day of the month) | Creator | The submission deadline for Activity Report [Report ID] is near. | Take action |  |  |  |  |  | NEW - Wishlist item 03/24/26 Digest? |
|  | Out of scope | Email | System | Near report submission deadline (5th working day of the month) | Creator | Submit draft Activity Report [Report ID]: Submission deadline 07/05/2026 |  |  |  |  |  |  | Version 2 per Heather - https://adhoc.slack.com/archives/C022R5301L4/p1774474899507799 |
|  | Out of scope | In-app | System | Near report submission deadline (5th working day of the month) | Collaborator | The submission deadline for Activity Report [Report ID] is near. | Take action |  |  |  |  |  |  |
|  | Out of scope | Email | System | Near report submission deadline (5th working day of the month) | Collaborator | Submit draft Activity Report [Report ID]: Submission deadline 07/05/2026 |  |  |  |  |  |  |  |
|  | Out of scope | In-app | System | Activity Report pending approval for "X' days | TTAC/Managers | An Activity Report for [Recipient name] has been pending approval for "X" days. | View AR |  |  |  |  |  | NEW - Wishlist item 03/24/26 Digest? |
|  | Out of scope | Email | System | Activity Report pending approval for "X' days | TTAC/Managers | Activity Report [Report ID]: Pending approval for "X" days |  |  |  |  |  |  | Version 2 - https://adhoc.slack.com/archives/C022R5301L4/p1774474899507799 |
| AR-10a | Proposed | Email | Digest | Activity Reports for review | Approvers | TTA Hub [daily/weekly/monthly] digest: Activity Reports for approval |  | `cf logs <environment under test> \| grep -E 'approverAssignedDigest\b'` |  |  |  |  | Digest |
| AR-11 | Proposed | Email | Digest | Activity Reports need action | Creator/Collaborator | TTA Hub [daily/weekly/monthly] digest: Activity Report changes requested |  | `cf logs <environment under test> \| grep -E 'changesRequestedDigest\b'` |  |  |  |  |  |
| AR-12 | Proposed | Email | Digest | Activity Reports - approved | Creator/Collaborator | TTA Hub [daily/weekly/monthly] digest: approved Activity Reports |  | `cf logs <environment under test> \| grep -E 'reportApprovedDigest\b'` |  |  |  |  |  |
| AR-13 | Proposed | Email | Digest | Added as a Collaborator | Collaborator | TTA Hub [daily/weekly/monthly] digest: added as collaborator on Activity Reports |  | `cf logs <environment under test> \| grep -E 'collaboratorDigest\b'` |  |  |  |  |  |
| AR-14 | Proposed | Email | Digest | Creator submits AR where I'm the Collab | Collaborator | TTA Hub [daily/weekly/monthly] digest: Activity Reports submitted for approval |  | Email digest · planned `ACTIVITY_REPORT_SUBMITTED_TO_COLLABORATOR_DIGEST` — not yet wired |  |  |  |  |  |
| AR-15 | Proposed | Email | Digest | Collab submits a report for approval | Creator | TTA Hub [daily/weekly/monthly] digest: Activity Reports submitted for approval |  | Email digest · planned `ACTIVITY_REPORT_COLLABORATOR_SUBMITTED_DIGEST` — not yet wired |  |  |  |  |  |
| AR-1a | Proposed | In-app | Creator | Adds a Collaborator | Collaborator | [Creator's name] added you as a Collaborator on their Activity Report for [Recipient name]. | View AR | In-app · `Notifications.type=collaboratorAssigned` (flag on) |  |  |  |  |  |
| AR-1b | Published | Email | Creator | Adds a Collaborator | Collaborator | Activity Report [Report ID]: Added as collaborator |  | `cf logs <environment under test> \| grep -E 'collaboratorAssigned\b'` |  |  |  |  |  |
| AR-2a | Proposed | In-app | Creator | Submits a report for approval | Approvers | An Activity Report for [Recipient name] has been submitted for approval. | Review AR | In-app · `Notifications.type=approverAssigned` (flag on) |  |  |  |  | review vs. approval? Go with Approval |
| AR-2b | Published | Email | Creator | Submits a report for approval | Approvers | Activity Report [Report ID]: Submitted for approval |  | `cf logs <environment under test> \| grep -E 'approverAssigned\b'` |  |  |  |  | updated existing message with "approval" |
| AR-2c | Proposed | In-app | Creator | Submits a report for approval | Collaborators | [Creator's name] has submitted an Activity Report for approval. | View AR | In-app · `Notifications.type=approverAssigned` (flag on) |  |  |  |  |  |
| AR-2d | Proposed | Email | Creator | Submits a report for approval | Collaborators | Activity Report [Report ID]: Submitted for approval |  | `cf logs <environment under test> \| grep -E 'approverAssigned\b'` |  |  |  |  | Do we have this? |
| AR-3a | Proposed | In-app | Collaborator | Submits a report for approval | Approvers | An Activity Report for [Recipient name] has been submitted for approval. | Review AR | In-app · `Notifications.type=approverAssigned` (flag on) |  |  |  |  |  |
| AR-3b | Proposed | Email | Collaborator | Submits a report for approval | Approvers | Activity Report [Report ID]: Submitted for approval |  | `cf logs <environment under test> \| grep -E 'approverAssigned\b'` |  |  |  |  |  |
| AR-3c | Proposed | In-app | Collaborator | Submits a report for approval | Creator | [Collaborator's name] has submitted an Activity Report for approval. | View AR | In-app · `Notifications.type=approverAssigned` (flag on) |  |  |  |  |  |
| AR-3d | Proposed | Email | Collaborator | Submits a report for approval | Creator | Activity Report [Report ID]: Submitted for approval |  | `cf logs <environment under test> \| grep -E 'approverAssigned\b'` |  |  |  |  |  |
| AR-4a | Proposed | In-app | Creator | Re-submit a report for approval | Approvers | A revised Activity Report for [Recipient name] has been submitted for approval. | Review AR | In-app · `Notifications.type=activityReportResubmitted` (flag on) |  |  |  |  |  |
| AR-4b | Proposed | Email | Creator | RE-submit a report for approval | Approvers | Revised Activity Report [Report ID]: Submitted for approval |  | Email · planned `activityReportResubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| AR-4c | Proposed | In-app | Creator | Re-submit a report for approval | Collaborator | A revised Activity Report for [Recipient name] has been submitted for approval. | View AR | In-app · `Notifications.type=activityReportResubmitted` (flag on) |  |  |  |  |  |
| AR-4d | Proposed | Email | Creator | Re-submit a report for approval | Collaborator | Revised Activity Report [Report ID]: Submitted for approval |  | Email · planned `activityReportResubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| AR-5a | Proposed | In-app | Collaborator | RE-submit a report for approval | Approvers | A revised Activity Report for [Recipient name] has been submitted for approval. | Review AR | In-app · `Notifications.type=activityReportResubmitted` (flag on) |  |  |  |  |  |
| AR-5b | Proposed | Email | Collaborator | RE-submit a report for approval | Approvers | Revised Activity Report [Report ID]: Submitted for approval |  | Email · planned `activityReportResubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| AR-5c | Proposed | In-app | Collaborator | RE-submit a report for approval | Creator | [Collaborator's name] has submitted a revised Activity Report for approval. | View AR | In-app · `Notifications.type=activityReportResubmitted` (flag on) |  |  |  |  |  |
| AR-5d | Proposed | Email | Collaborator | RE-submit a report for approval | Creator | Revised Activity Report [Report ID]: Submitted for approval |  | Email · planned `activityReportResubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| AR-6a | Proposed | In-app | Approver 1 | Reviews report and sets status to needs action | Creator | [Approver 1 name] has requested changes to your Activity Report for [Recipient name]. | Take action/View AR | In-app · `Notifications.type=changesRequested` (flag on) |  |  |  |  |  |
| AR-6b | Published | Email | Approver 1 | Reviews report and sets status to needs action | Creator | Activity Report [Report ID]: Changes requested |  | `cf logs <environment under test> \| grep -E 'changesRequested\b'` |  |  |  |  | Text includes Approver name |
| AR-6c | Proposed | In-app | Approver 1 | Reviews report and sets status to needs action | Collaborator | [Approver 1 name] has requested changes to your Activity Report for [Recipient name]. | Take action | In-app · `Notifications.type=changesRequested` (flag on) |  |  |  |  |  |
| AR-6d | Proposed | Email | Approver 1 | Reviews report and sets status to needs action | Collaborator | Activity Report [Report ID]: Changes requested |  | `cf logs <environment under test> \| grep -E 'changesRequested\b'` |  |  |  |  |  |
| AR-6e | Proposed | In-app | Approver 1 | Reviews report and sets status to needs action | Approver 2 | [Approver 1 name] has requested changes to an Activity Report for [Recipient name]. | View AR | In-app · `Notifications.type=changesRequested` (flag on) |  |  |  |  |  |
| AR-6f | Proposed | Email | Approver 1 | Reviews report and sets status to needs action | Approver 2 | Activity Report [Report ID]: Changes requested by [Approver 1 name] |  | `cf logs <environment under test> \| grep -E 'changesRequested\b'` |  |  |  |  | LInk text is different for Approver 2 |
| AR-7a | Proposed | In-app | Approver 1 | Reviews report and sets status to approved | Creator | [Approver 1 name] has approved your Activity Report for [Recipient name]. | View AR | In-app · `Notifications.type=reportApproved` (flag on) |  |  |  |  |  |
| AR-7b | Published | Email | Approver 1 | Reviews report and sets status to approved | Creator | Activity Report [Report ID]: Approved |  | `cf logs <environment under test> \| grep -E 'reportApproved\b'` |  |  |  |  | Added approver name |
| AR-7c | Proposed | In-app | Approver 1 | Reviews report and sets status to approved | Collaborator | [Approver 1 name] has approved your Activity Report for [Recipient name]. | View AR | In-app · `Notifications.type=reportApproved` (flag on) |  |  |  |  |  |
| AR-7d | Published | Email | Approver 1 | Reviews report and sets status to approved | Collaborator | Activity Report [Report ID]: Approved |  | `cf logs <environment under test> \| grep -E 'reportApproved\b'` |  |  |  |  |  |
| AR-7e | Proposed | In-app | Approver 1 | Reviews report and sets status to approved | Approver 2 | [Approver 1 name] has approved your Activity Report for [Recipient name]. | View AR | In-app · `Notifications.type=reportApproved` (flag on) |  |  |  |  |  |
| AR-7f | Proposed | Email | Approver 1 | Reviews report and sets status to approved | Approver 2 | Activity Report [Report ID]: Approved by [Approver 1 name] |  | `cf logs <environment under test> \| grep -E 'reportApproved\b'` |  |  |  |  |  |
| AR-8a | Proposed | In-app | Approver 2 | Reviews report and sets status to needs action | Creator | [Approver 2 name] has requested changes to your Activity Report for [Recipient name]. | Take action/View AR | In-app · `Notifications.type=changesRequested` (flag on) |  |  |  |  |  |
| AR-8b | Proposed | Email | Approver 2 | Reviews report and sets status to needs action | Creator | Activity Report [Report ID]: Changes requested |  | `cf logs <environment under test> \| grep -E 'changesRequested\b'` |  |  |  |  | Text includes Approver name, update existing email |
| AR-8c | Proposed | In-app | Approver 2 | Reviews report and sets status to needs action | Collaborator | [Approver 2 name] has requested changes to your Activity Report for [Recipient name]. | Take action | In-app · `Notifications.type=changesRequested` (flag on) |  |  |  |  |  |
| AR-8d | Proposed | Email | Approver 2 | Reviews report and sets status to needs action | Collaborator | Activity Report [Report ID]: Changes requested |  | `cf logs <environment under test> \| grep -E 'changesRequested\b'` |  |  |  |  |  |
| AR-8e | Proposed | In-app | Approver 2 | Reviews report and sets status to needs action | Approver 1 | [Approver 2 name] has requested changes to an Activity Report for [Recipient name]. | View AR | In-app · `Notifications.type=changesRequested` (flag on) |  |  |  |  |  |
| AR-8f | Proposed | Email | Approver 2 | Reviews report and sets status to needs action | Approver 1 | Activity Report [Report ID]: Changes requested by [Approver 2 name] |  | `cf logs <environment under test> \| grep -E 'changesRequested\b'` |  |  |  |  | LInk text is different for Approver 1 |
| AR-9a | Proposed | In-app | Approver 2 | Reviews report and sets status to approved | Creator | [Approver 2 name] has approved your Activity Report for [Recipient name]. | View AR | In-app · `Notifications.type=reportApproved` (flag on) |  |  |  |  |  |
| AR-9b | Proposed | Email | Approver 2 | Reviews report and sets status to approved | Creator | Activity Report [Report ID]: Approved |  | `cf logs <environment under test> \| grep -E 'reportApproved\b'` |  |  |  |  |  |
| AR-9c | Proposed | In-app | Approver 2 | Reviews report and sets status to approved | Collaborator | [Approver 2 name] has approved your Activity Report for [Recipient name].. | View AR | In-app · `Notifications.type=reportApproved` (flag on) |  |  |  |  |  |
| AR-9d | Proposed | Email | Approver 2 | Reviews report and sets status to approved | Collaborator | Activity Report [Report ID]: Approved |  | `cf logs <environment under test> \| grep -E 'reportApproved\b'` |  |  |  |  |  |
| AR-9e | Proposed | In-app | Approver 2 | Reviews report and sets status to approved | Approver 1 | [Approver 2 name] has approved your Activity Report for [Recipient name]. | View AR | In-app · `Notifications.type=reportApproved` (flag on) |  |  |  |  |  |
| AR-9f | Proposed | Email | Approver 2 | Reviews report and sets status to approved | Approver 1 | Activity Report [Report ID]: Approved by [Approver 2 name] |  | `cf logs <environment under test> \| grep -E 'reportApproved\b'` |  |  |  |  |  |

## Test Matrix — Collaboration Reports (50)

| ID | Status | Channel | Role (actor) | Trigger | Received by | Expected subject / in-app content | CTA | Verify (in-app table / email log) | Logged-in as | Pass / Fail | Tester | Build | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CR-10a | Proposed | Email | Digest | Collaboration Reports for approval | Approvers | TTA Hub [daily/weekly/monthly] digest: Collaboration Reports for approval |  | Email digest · planned `COLLAB_REPORT_SUBMITTED_DIGEST` — not yet wired |  |  |  |  |  |
| CR-11 | Proposed | Email | Digest | Collaboration Reports needs action | Creator/Collaborator | Subject: TTA Hub [daily/weekly/monthly] digest: Collaboration Report changes requested |  | Email digest · planned `COLLAB_REPORT_NEEDS_ACTION_DIGEST` — not yet wired |  |  |  |  |  |
| CR-12 | Proposed | Email | Digest | Collaboration Reports - approved | Creator/Collaborator | Subject: TTA Hub [daily/weekly/monthly] digest: approved Collaboration Reports |  | Email digest · planned `COLLAB_REPORT_APPROVED_DIGEST` — not yet wired |  |  |  |  |  |
| CR-13 | Proposed | Email | Digest | Added as a Collaborator | Collaborator | TTA Hub [daily/weekly/monthly] digest: added as collaborator on Collaboration Reports |  | Email digest · planned `COLLAB_REPORT_COLLABORATOR_DIGEST` — not yet wired |  |  |  |  |  |
| CR-14 | Proposed | Email | Digest | Collaboration Reports need action | Creator/Collaborator | TTA Hub [daily/weekly/monthly] digest: Collaboration Report changes requested |  | Email digest · planned `COLLAB_REPORT_NEEDS_ACTION_DIGEST` — not yet wired |  |  |  |  |  |
| CR-15 | Proposed | Email | Digest | Collab Report - approved | Creator/Collaborator | TTA Hub [daily/weekly/monthly] digest: approved Collaboration Reports |  | Email digest · planned `COLLAB_REPORT_APPROVED_DIGEST` — not yet wired |  |  |  |  |  |
| CR-16 | Proposed | Email | Digest | Creator submits CR where I'm the Collab | Collaborator | TTA Hub [daily/weekly/monthly] digest: Collaboration Reports submitted for approval |  | Email digest · planned `COLLAB_REPORT_SUBMITTED_TO_COLLABORATOR_DIGEST` — not yet wired |  |  |  |  |  |
| CR-17 | Proposed | Email | Digest | Collab submits a report for approval | Creator | TTA Hub [daily/weekly/monthly] digest: Collaboration Reports submitted for approval |  | Email digest · planned `COLLAB_REPORT_COLLABORATOR_SUBMITTED_DIGEST` — not yet wired |  |  |  |  |  |
| CR-1a | Proposed | In-app | Creator | Adds a Collaborator | Collaborator | [Creator's name] added you as a Collaborator on their Collaboration Report for [Activity name]. | View AR | In-app · `Notifications.type=collabReportCollaboratorAdded` (flag on) |  |  |  |  |  |
| CR-1b | Proposed | Email | Creator | Adds a Collaborator | Collaborator | Collaboration Report [Report ID]: Added as collaborator |  | Email · planned `collabReportCollaboratorAdded` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-2a | Proposed | In-app | Creator | Submits a report for approval | Approvers | [Creator's name] submitted the [Activity name] Collaboration Report for approval. | Review CR | In-app · `Notifications.type=collabReportSubmitted` (flag on) |  |  |  |  |  |
| CR-2b | Proposed | Email | Creator | Submits a report for approval | Approvers | Collaboration Report [Report ID]: Submitted for approval |  | Email · planned `collabReportSubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-2c | Proposed | In-app | Creator | Submits a report for approval | Collaborator | [Creator's name] submitted the [Activity name] Collaboration Report for approval. | View CR | In-app · `Notifications.type=collabReportSubmitted` (flag on) |  |  |  |  |  |
| CR-2d | Proposed | Email | Creator | Submits a report for approval | Collaborator | Collaboration Report [Report ID]: Submitted for approval |  | Email · planned `collabReportSubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-3a | Proposed | In-app | Collaborator | Submits a report for approval | Approvers | [Collaborator's name] submitted the [Activity name] Collaboration Report for approval. | Review CR | In-app · `Notifications.type=collabReportSubmitted` (flag on) |  |  |  |  |  |
| CR-3b | Proposed | Email | Collaborator | Submits a report for approval | Approvers | Collaborator Report [Report ID]: Submitted for approval |  | Email · planned `collabReportSubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-3c | Proposed | In-app | Collaborator | Submits a report for approval | Creator | [Collaborator's name] submitted the [Activity name] Collaboration Report for approval. | View CR | In-app · `Notifications.type=collabReportSubmitted` (flag on) |  |  |  |  |  |
| CR-3d | Proposed | Email | Collaborator | Submits a report for approval | Creator | Collaborator Report [Report ID]: Submitted for approval |  | Email · planned `collabReportSubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-4a | Proposed | In-app | Creator | Re-submit a report for approval | Approvers | [Creator's name] submitted the revised [Activity name] Collaboration Report for approval. | Review CR | In-app · `Notifications.type=collabReportResubmitted` (flag on) |  |  |  |  | Add Title |
| CR-4b | Proposed | Email | Creator | Re-submit a report for approval | Approvers | Revised Collaboration Report [Report ID]: Submitted for approval |  | Email · planned `collabReportResubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-4c | Proposed | In-app | Creator | Re-submit a report for approval | Collaborators | [Creator's name] submitted the revised [Activity name] Collaboration Report for approval. | View CR | In-app · `Notifications.type=collabReportResubmitted` (flag on) |  |  |  |  |  |
| CR-4d | Proposed | Email | Creator | Re-submit a report for approval | Collaborators | Revised Collaboration Report [Report ID]: Submitted for approval |  | Email · planned `collabReportResubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-5a | Proposed | In-app | Collaborator | Re-submit a report for approval | Approvers | [Collaborator's name] submitted the revised [Activity name] Collaboration Report for approval. | Review CR | In-app · `Notifications.type=collabReportResubmitted` (flag on) |  |  |  |  |  |
| CR-5b | Proposed | Email | Collaborator | Re-submit a report for approval | Approvers | Revised Collaboration Report [Report ID]: Submitted for approval |  | Email · planned `collabReportResubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-5c | Proposed | In-app | Collaborator | Re-submit a report for approval | Creator | [Collaborator's name] has submitted a revised Collaboration Report for [Activity name]. | View CR | In-app · `Notifications.type=collabReportResubmitted` (flag on) |  |  |  |  |  |
| CR-5d | Proposed | Email | Collaborator | Re-submit a report for approval | Creator | Revised Collaboration Report [Report ID]: Submitted for approval |  | Email · planned `collabReportResubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-6a | Proposed | In-app | Approver 1 | Reviews report and sets status to needs action | Creator | [Approver 1 name] has requested changes to your Collaboration Report for [Activity name]. | Take action/View AR | In-app · `Notifications.type=collabReportNeedsAction` (flag on) |  |  |  |  |  |
| CR-6b | Proposed | Email | Approver 1 | Reviews report and sets status to needs action | Creator | Collaboration Report [Report ID]: Changes requested |  | Email · planned `collabReportNeedsAction` — not yet in EMAIL_ACTIONS |  |  |  |  | Text includes Approver name |
| CR-6c | Proposed | In-app | Approver 1 | Reviews report and sets status to needs action | Collaborator | [Approver 1 name] has requested changes to your Collaboration Report for [Activity name]. | Take action | In-app · `Notifications.type=collabReportNeedsAction` (flag on) |  |  |  |  |  |
| CR-6d | Proposed | Email | Approver 1 | Reviews report and sets status to needs action | Collaborator | Collaboration Report [Report ID]: Changes requested |  | Email · planned `collabReportNeedsAction` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-6e | Proposed | In-app | Approver 1 | Reviews report and sets status to needs action | Approver 2 | [Approver 1 name] has requested changes to your Collaboration Report for [Activity name]. | View AR | In-app · `Notifications.type=collabReportNeedsAction` (flag on) |  |  |  |  |  |
| CR-6f | Proposed | Email | Approver 1 | Reviews report and sets status to needs action | Approver 2 | Collaboration Report [Report ID]: Changes requested by [Approver 1 name] |  | Email · planned `collabReportNeedsAction` — not yet in EMAIL_ACTIONS |  |  |  |  | LInk text is different for Approver 2 |
| CR-7a | Proposed | In-app | Approver 1 | Reviews report and sets status to approved | Creator | [Approver 1 name] has approved your Collaboration Report for [Activity name]. | View AR | In-app · `Notifications.type=collabReportApproved` (flag on) |  |  |  |  |  |
| CR-7b | Proposed | Email | Approver 1 | Reviews report and sets status to approved | Creator | Collaboration Report [Report ID]: Approved |  | Email · planned `collabReportApproved` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-7c | Proposed | In-app | Approver 1 | Reviews report and sets status to approved | Collaborator | [Approver 1 name] has approved your Collaboration Report for [Activity name]. | View AR | In-app · `Notifications.type=collabReportApproved` (flag on) |  |  |  |  |  |
| CR-7d | Proposed | Email | Approver 1 | Reviews report and sets status to approved | Collaborator | Collaboration Report [Report ID]: Approved |  | Email · planned `collabReportApproved` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-7e | Proposed | In-app | Approver 1 | Reviews report and sets status to approved | Approver 2 | [Approver 1 name] has approved a Collaboration Report for [Activity name]. | View AR | In-app · `Notifications.type=collabReportApproved` (flag on) |  |  |  |  |  |
| CR-7f | Proposed | Email | Approver 1 | Reviews report and sets status to approved | Approver 2 | Collaboration Report [Report ID]: Approved by [Approver 1 name] |  | Email · planned `collabReportApproved` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-8a | Proposed | In-app | Approver 2 | Reviews report and sets status to needs action | Creator | [Approver 2 name] has requested changes to your Collaboration Report for [Activity name]. | Take action/View AR | In-app · `Notifications.type=collabReportNeedsAction` (flag on) |  |  |  |  |  |
| CR-8b | Proposed | Email | Approver 2 | Reviews report and sets status to needs action | Creator | Collaboration Report [Report ID]: Changes requested |  | Email · planned `collabReportNeedsAction` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-8c | Proposed | In-app | Approver 2 | Reviews report and sets status to needs action | Collaborator | [Approver 2 name] has requested changes to your Collaboration Report for [Activity name]. | Take action | In-app · `Notifications.type=collabReportNeedsAction` (flag on) |  |  |  |  |  |
| CR-8d | Proposed | Email | Approver 2 | Reviews report and sets status to needs action | Collaborator | Collaboration Report [Report ID]: Changes requested |  | Email · planned `collabReportNeedsAction` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-8e | Proposed | In-app | Approver 2 | Reviews report and sets status to needs action | Approver 1 | [Approver 2 name] has requested changes to Collaboration Report for [Activity name]. | View AR | In-app · `Notifications.type=collabReportNeedsAction` (flag on) |  |  |  |  |  |
| CR-8f | Proposed | Email | Approver 2 | Reviews report and sets status to needs action | Approver 1 | Collaboration Report [Report ID]: Changes requested by [Approver 2 name] |  | Email · planned `collabReportNeedsAction` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-9a | Proposed | In-app | Approver 2 | Reviews report and sets status to approved | Creator | [Approver 2 name] has approved your Collaboration Report for [Activity name]. | View AR | In-app · `Notifications.type=collabReportApproved` (flag on) |  |  |  |  |  |
| CR-9b | Proposed | Email | Approver 2 | Reviews report and sets status to approved | Creator | Collaboration Report [Report ID]:  Approved |  | Email · planned `collabReportApproved` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-9c | Proposed | In-app | Approver 2 | Reviews report and sets status to approved | Collaborator | [Approver 2 name] has approved your Collaboration Report for [Activity name]. | View AR | In-app · `Notifications.type=collabReportApproved` (flag on) |  |  |  |  |  |
| CR-9d | Proposed | Email | Approver 2 | Reviews report and sets status to approved | Collaborator | Collaboration Report [Report ID]:  Approved |  | Email · planned `collabReportApproved` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-9e | Proposed | In-app | Approver 2 | Reviews report and sets status to approved | Approver 1 | [Approver 2 name] has approved a Collaboration Report for [Activity name]. | View AR | In-app · `Notifications.type=collabReportApproved` (flag on) |  |  |  |  |  |
| CR-9f | Proposed | Email | Approver 2 | Reviews report and sets status to approved | Approver 1 | Collaboration Report [Report ID]: Approved by [Approver 2 name] |  | Email · planned `collabReportApproved` — not yet in EMAIL_ACTIONS |  |  |  |  |  |

## Test Matrix — Training Reports (53)

| ID | Status | Channel | Role (actor) | Trigger | Received by | Expected subject / in-app content | CTA | Verify (in-app table / email log) | Logged-in as | Pass / Fail | Tester | Build | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TR-10a | Paused | In-app | System | Session info missing 20 days past the session start date | Event Collaborator | Submit session details for [Session name]. |  | Out of scope (Paused) |  |  |  |  | #7 |
| TR-10b | Paused | Email | System | Session info missing 20 days past the session start date | Event Collaborator | Reminder: Submit session details for Training Report [Report ID] |  | Out of scope (Paused) |  |  |  |  | #7 |
| TR-10c | Paused | Email | System | Session info missing 20 days past reminder | Event Collaborator | Past due: Submit session details for Training Report [Report ID] |  | Out of scope (Paused) |  |  |  |  | #8 |
| TR-11a | Paused | In-app | System | Session info missing 20 days past session start date | Regional POC | Submit session details for [Session name]. | Take action | Out of scope (Paused) |  |  |  |  | #9 |
| TR-11b | Paused | Email | System | Session info missing 20 days past session start date | Regional POC | Reminder: Submit Session Details for Training Report |  | Out of scope (Paused) |  |  |  |  | #9 |
| TR-12 | Paused | Email | System | Session info missing 20 days past email reminder | Regional POC | Past due: Submit session details for Training Report [Report ID] |  | Out of scope (Paused) |  |  |  |  | #10 No in-app or opt-out option. In-app, event info missing will still be displayed in notification center. Repeats every 10 days if no action is taken |
| TR-13 | Paused | Email | System | No sessions created 20 days past event end date | Event Creator | Reminder: Create a Session for Training Report [Report ID] |  | Out of scope (Paused) |  |  |  |  | #11 |
| TR-14 | Paused | Email | System | No sessions created 20 days past reminder | Event Creator | Past due: Create a Session for Training Report [Report ID] |  | Out of scope (Paused) |  |  |  |  | #12 No in-app or opt-out option. In-app, event info missing will still be displayed in notification center. Repeats every 10 days if no action is taken |
| TR-15 | Paused | Email | System | No sessions created 20 days past event end date | Event Collaborator | Reminder: Create a Session for Training Report [Report ID] |  | Out of scope (Paused) |  |  |  |  | #13 |
| TR-16 | Paused | Email | System | No sessions 20 days past email reminder | Event Collaborator | Past due: Create a Session for Training Report [Report ID] |  | Out of scope (Paused) |  |  |  |  | #14 No in-app or opt-out option. In-app, event info missing will still be displayed in notification center. Repeats every 10 days if no action is taken |
| TR-17 | Paused | Email | System | Event not completed 20 days past event end date | Event Creator | Reminder: Complete Training Report [Report ID] |  | Out of scope (Paused) |  |  |  |  | #15 |
| TR-18 | Paused | Email | System | Event not completed 20 days past reminder | Event Creator | Past due: Complete Training Report [Report ID] |  | Out of scope (Paused) |  |  |  |  | #16 No in-app or opt-out option. In-app, event info missing will still be displayed in notification center. Repeats every 10 days if no action is taken |
| TR-19 | Proposed | Email | Digest | Added as an Event POC | Event POC | TTA Hub [daily/weekly/monthly] digest: added as a Regional point of contact |  | Email digest · planned `TRAINING_REPORT_POC_ADDED_DIGEST` — not yet wired |  |  |  |  |  |
| TR-1a | Proposed | In-app | Event Creator | Adds a Collaborator as a POC | Event POC | [Creator's name] added you as a Regional point of contact on their Training Report. | View TR | In-app · `Notifications.type=trainingReportPocAdded` (flag on) |  |  |  |  | Spell out point of contact? yes |
| TR-1b | Proposed | Email | Event Creator | Adds a Collaborator as a POC | Event POC | Training Report [Report ID]: Added as Regional point of contact |  | Email · planned `trainingReportPocAdded` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| TR-20 | Proposed | Email | Digest | Added as Event Collaborator | Event Collaborator | TTA Hub [daily/weekly/monthly] digest: added as an Event Collaborator |  | Email digest · planned `TRAINING_REPORT_COLLABORATOR_ADDED_DIGEST` — not yet wired |  |  |  |  |  |
| TR-21 | Proposed | Email | Digest | session submitted for review | Approvers | TTA Hub [daily/weekly/monthly] digest: session submitted for review |  | Email digest · planned `TRAINING_REPORT_SESSION_SUBMITTED_DIGEST` — not yet wired |  |  |  |  |  |
| TR-22 | Proposed | Email | Digest | Session changes requested | Event Creator/Event Collaborator | TTA Hub [daily/weekly/monthly] digest: session changes requested |  | Email digest · planned `TRAINING_REPORT_SESSION_NEEDS_ACTION_DIGEST` — not yet wired |  |  |  |  |  |
| TR-23 | Proposed | Email | Digest | Event details not complete | Event Collaborator | TTA Hub [daily/weekly/monthly] digest: submit event details |  | Email digest · planned `TRAINING_REPORT_EVENT_INFO_MISSING_DIGEST` — not yet wired |  |  |  |  |  |
| TR-24 | Proposed | Email | Digest | Session details not complete | Event Creator/Event Collaborator | TTA Hub [daily/weekly/monthly] digest: submit session details |  | Email digest · planned `TRAINING_REPORT_SESSION_INFO_MISSING_DIGEST` — not yet wired |  |  |  |  |  |
| TR-25 | Proposed | Email | Digest | Session details not complete (POC) | Regional POC | TTA Hub [daily/weekly/monthly] digest: submit session details |  | Email digest · planned `TRAINING_REPORT_SESSION_INFO_MISSING_DIGEST` — not yet wired |  |  |  |  |  |
| TR-26 | Proposed | Email | Digest | No sessions created 20 days past event end date | Event Creator/Event Collaborator | TTA Hub [daily/weekly/monthly] digest: Past due - Create a session |  | Email digest · planned `TRAINING_REPORT_NO_SESSIONS_CREATED_DIGEST` — not yet wired |  |  |  |  |  |
| TR-27 | Proposed | Email | Digest | Event not completed 20 days past event end date | Event Creator | TTA Hub [daily/weekly/monthly] digest: Past due - Complete event |  | Email digest · planned `TRAINING_REPORT_EVENT_NOT_COMPLETED_DIGEST` — not yet wired |  |  |  |  |  |
| TR-2a | Proposed | In-app | Event Creator | Adds a Collaborator | Event Collaborator | [Creator's name] added you as a Collaborator on their Training Report. | View TR | In-app · `Notifications.type=trainingReportCollaboratorAdded` (flag on) |  |  |  |  |  |
| TR-2b | Proposed | Email | Event Creator | Adds a Collaborator | Event Collaborator | Training Report [Report ID]: Added as Collaborator |  | `cf logs <environment under test> \| grep -E 'trainingReportCollaboratorAdded\b'` |  |  |  |  |  |
| TR-3a | Proposed | In-app | Event Creator | Submits a session for approval | Approver | Session: [Session name] submitted for approval. | Take action | In-app · `Notifications.type=trainingReportSessionSubmitted` (flag on) |  |  |  |  | Event POC, Session Approver? |
| TR-3b | Proposed | Email | Event Creator | Submits a session for approval | Approver | Training Report [Report ID]: [Session name] submitted for approval. |  | Email · planned `trainingReportSessionSubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| TR-3c | Proposed | In-app | Event Creator | Submits a session for approval | Event Collaborator | Session: [Session name] submitted for approval. | View TR | In-app · `Notifications.type=trainingReportSessionSubmitted` (flag on) |  |  |  |  |  |
| TR-3d | Proposed | Email | Event Creator | Submits a session for approval | Event Collaborator | Training Report [Report ID]: [Session name] submitted for approval. |  | Email · planned `trainingReportSessionSubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| TR-3e | Proposed | In-app | Event Creator | Submits a session for approval | Event Collaborator | Training Report [Report ID]: [Session name] submitted for approval. | View TR | In-app · `Notifications.type=trainingReportSessionSubmitted` (flag on) |  |  |  |  |  |
| TR-4a | Proposed | In-app | Approver 1 | Reviews session report and sets status to needs action | Creator | [Approver 1 name] has requested changes to session [Session name]. | View TR | In-app · `Notifications.type=trainingReportSessionNeedsAction` (flag on) |  |  |  |  |  |
| TR-4b | Proposed | Email | Approver 1 | Reviews session report and sets status to needs action | Creator | Training Report [Report ID]: Session changes requested |  | Email · planned `trainingReportSessionNeedsAction` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| TR-4c | Proposed | In-app | Approver 1 | Reviews session report and sets status to needs action | Event Collaborator | [Approver 1 name] has requested changes to session: [Session name]. | View TR | In-app · `Notifications.type=trainingReportSessionNeedsAction` (flag on) |  |  |  |  |  |
| TR-4d | Proposed | Email | Approver 1 | Reviews session report and sets status to needs action | Event Collaborator | Training Report [Report ID]: Session changes requested |  | Email · planned `trainingReportSessionNeedsAction` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| TR-4e | Proposed | In-app | Approver 1 | Reviews session report and sets status to needs action | Session Approver 2 | [Approver 1 name] has requested changes to session: [Session name]. | View TR | In-app · `Notifications.type=trainingReportSessionNeedsAction` (flag on) |  |  |  |  |  |
| TR-4f | Proposed | Email | Approver 1 | Reviews session report and sets status to needs action | Session Approver 2 | Training Report [Report ID]: Session changes requested |  | Email · planned `trainingReportSessionNeedsAction` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| TR-5a | Proposed | In-app | Event Creator | Re-submit a session for review | Approvers | A revised Training Report session: [Session name], has been submitted for review. |  | In-app · `Notifications.type=trainingReportSessionResubmitted` (flag on) |  |  |  |  | Remove block |
| TR-5a | Proposed | In-app | System | Event info missing 20 days past event start date | Event Creator | Submit event details for [Event name]. | Take action | In-app · `Notifications.type=trainingReportEventInfoMissing` (flag on) |  |  |  |  | Event Specialist? |
| TR-5b | Proposed | Email | Event Creator | Re-submit a session for review | Approvers | Revised Training Report [Report ID]: [Session name] submitted for review |  | Email · planned `trainingReportSessionResubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| TR-5b | Paused | Email | System | Event info missing 20 days past event start date | Event Creator | Reminder: Submit event details for Training Report [Report ID] |  | Out of scope (Paused) |  |  |  |  | #1 |
| TR-5c | Proposed | In-app | Event Creator | Re-submit a session for review | Event Collaborator | A revised Training Report session: [Session name], has been submitted for review. |  | In-app · `Notifications.type=trainingReportSessionResubmitted` (flag on) |  |  |  |  |  |
| TR-5d | Proposed | Email | Event Creator | Re-submit a sessionfor review | Event Collaborator | Revised Training Report [Report ID]: [Session name] submitted for review |  | Email · planned `trainingReportSessionResubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| TR-6a | Proposed | In-app | Event Collaborator | Re-submit a session for review | Approvers | A revised Training Report has been submitted for review. |  | In-app · `Notifications.type=trainingReportSessionResubmitted` (flag on) |  |  |  |  | Does Collaborating Specialist submit TR's? |
| TR-6a | Paused | Email | System | Event info missing 20 days past previous email reminder | Event Creator | Past due: Submit event details for Training Report [Report ID] |  | Out of scope (Paused) |  |  |  |  | #2 No in-app or opt-out option. In-app, event info missing will still be displayed in notification center. Repeats every 10 days if no action is taken |
| TR-6b | Proposed | Email | Event Collaborator | Re-submit a session for review | Approvers | Revised Training Report [Report ID]: Submitted for review |  | Email · planned `trainingReportSessionResubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  | Remove block |
| TR-6c | Proposed | In-app | Event Collaborator | Re-submit a session for review | Event Creator | A revised Training Report has been submitted for review. |  | In-app · `Notifications.type=trainingReportSessionResubmitted` (flag on) |  |  |  |  |  |
| TR-6d | Proposed | Email | Event Collaborator | Re-submit a session for review | Event Creator | Revised Training Report [Report ID]: Submitted for review |  | Email · planned `trainingReportSessionResubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| TR-7a | Proposed | In-app | System | Event info missing 20 days past event start date | Event Collaborator | Submit event details for [Event name]. | Take action | In-app · `Notifications.type=trainingReportEventInfoMissing` (flag on) |  |  |  |  |  |
| TR-7b | Paused | Email | System | Event info missing 20 days past event start date | Event Collaborator | Reminder: Submit event details for Training Report [Report ID] |  | Out of scope (Paused) |  |  |  |  | #3 |
| TR-8a | Paused | Email | System | Event info missing 20 days past previous email reminder | Event Collaborator | Past due: Submit event details for Training Report [Report ID] |  | Out of scope (Paused) |  |  |  |  | #4 No in-app or opt-out option. In-app, event info missing will still be displayed in notification center. Repeats every 10 days if no action is taken |
| TR-9a | Proposed | In-app | System | Session info missing 20 days past the session start date | Event Creator | Submit session details for [Session name]. | Take action | In-app · `Notifications.type=trainingReportSessionInfoMissing` (flag on) |  |  |  |  |  |
| TR-9b | Paused | Email | System | Session info missing 20 days past the session start date | Event Creator | Reminder: Submit session details for Training Report [Report ID] |  | Out of scope (Paused) |  |  |  |  | #5 |
| TR-9c | Paused | Email | System | Session info missing 20 days past the session start date | Event Creator | Past due: Submit session details for Training Report [Report ID] |  | Out of scope (Paused) |  |  |  |  | #6 No in-app or opt-out option. In-app, event info missing will still be displayed in notification center. Repeats every 10 days if no action is taken |

## Test Matrix — Communication Logs (6)

| ID | Status | Channel | Role (actor) | Trigger | Received by | Expected subject / in-app content | CTA | Verify (in-app table / email log) | Logged-in as | Pass / Fail | Tester | Build | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CL-1a | Proposed | In-app | Creator | Adds Other TTA staff to a Comm Log | TTA staff | [Creator's name] added you as TTA staff on their Communication Log for [Recipient name]. |  | In-app · `Notifications.type=communicationLogTtaStaffAdded` (flag on) |  |  |  |  |  |
| CL-1b | Proposed | Email | Creator | Adds Other TTA staff to a Comm Log | TTA staff | Communication Log R14-CL-12345: Added as TTA staff |  | Email · planned `communicationLogTtaStaffAdded` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CL-2a | Proposed | In-app | Creator | A Comm Log was entered for a recipient in a group | Program Specialist | A Communication Log was entered for your recipient: [Recipient name] from the group: [Group name]. |  | In-app · `Notifications.type=communicationLogRecipientInGroup` (flag on) |  |  |  |  | Anyone with a group or just Program Specialists? |
| CL-2b | Proposed | Email | Creator | A Comm Log was entered for a recipient in a group | Program Specialist | Communication Log R14-CL-12345: Entered for the recipient: [Recipient name] from group: [Group name] |  | Email · planned `communicationLogRecipientInGroup` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CL-3 | Proposed | Email | Digest | Added as TTA staff on a Comm log | TTA staff | Subject: TTA Hub [daily/weekly/monthly] digest: added as TTA staff on a Communication log |  | Email digest · planned `COMMUNICATION_LOG_TTA_STAFF_ADDED_DIGEST` — not yet wired |  |  |  |  |  |
| CL-4 | Proposed | Email | Digest | Comm log added for a recipient in "My group" | Program Specialist | Subject: TTA Hub [daily/weekly/monthly] digest: Communication log added for a recipient in one of your groups |  | Email digest · planned `COMMUNICATION_LOG_RECIPIENT_IN_GROUP_DIGEST` — not yet wired |  |  |  |  |  |

## Test Matrix — Other (Groups, Monitoring) (8)

| ID | Status | Channel | Role (actor) | Trigger | Received by | Expected subject / in-app content | CTA | Verify (in-app table / email log) | Logged-in as | Pass / Fail | Tester | Build | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Misc-1a | Draft | In-app | System | Adds/opens a monitoring goal | TTACs & Managers | New monitoring goals for recipients in your region are available. | View goals | In-app · `Notifications.type=monitoringGoalAdded` (flag on) |  |  |  |  | Will trigger when the monitoring goal is added to the RTR for the first iteration and any subsequent re-opens. Original content: "A monitoring goal for [Recipient name] is available in the TTA Hub." |
| Misc-1a | Proposed | In-app | System | New monitoring data was received. | TTACs & Managers | New monitoring details for [Recipient name] are available. | View details | In-app · `Notifications.type=monitoringDataReceived` (flag on) |  |  |  |  | Replaced monitoring goal language in row 159 & 160 |
| Misc-1b | Draft | Email | System | Adds/opens a monitoring goal | TTACs & Managers | New monitoring goals added for recipients in your region. |  | Email · planned `monitoringGoalAdded` — not yet in EMAIL_ACTIONS |  |  |  |  | We don't know what TTAC or Manager is associated with each recipient, do we? Phase 2? Original content: "Monitoring goal added for [Recipient name]. |
| Misc-1b | Proposed | Email | System | New monitoring data was received. | TTACs & Managers | New monitoring details were added for recipients in your region. |  | Email · planned `monitoringDataReceived` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| Misc-2a | Proposed | In-app | Group Creator | Adds a co-owner to "my group" | Group Co-owner | [Creator's name] added you as a co-owner of the group: [Group name]. |  | In-app · `Notifications.type=groupCoOwnerAdded` (flag on) |  |  |  |  |  |
| Misc-2b | Proposed | Email | Group Creator | Adds a co-owner to "my group" | Group Co-owner | Group [Group name]: Added as co-owner |  | Email · planned `groupCoOwnerAdded` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| Misc-3a | Proposed | In-app | Group Creator | Shares their "my group" | Group receiver | [Creator's name] shared the group: [Group name] with you. |  | In-app · `Notifications.type=groupShared` (flag on) |  |  |  |  |  |
| Misc-3b | Proposed | Email | Group Creator | Shares their "my group" | Group receiver | Group [Group name]: shared with you |  | Email · planned `groupShared` — not yet in EMAIL_ACTIONS |  |  |  |  |  |

## Test Matrix — System (Outages) (3)

| ID | Status | Channel | Role (actor) | Trigger | Received by | Expected subject / in-app content | CTA | Verify (in-app table / email log) | Logged-in as | Pass / Fail | Tester | Build | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Misc-4a | Proposed | In-app | System | TTA Hub planned outage | All roles | Planned outage: the TTA Hub will be closed for maintenance from [date through date]. |  | In-app · `Notifications.type=systemPlannedOutage` (flag on) |  |  |  |  |  |
| Misc-4b | Proposed | Email | System | TTA Hub planned outage | All roles | TTA Hub scheduled outage [day, month, day] |  | Email · planned `systemPlannedOutage` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| Misc-5a | Proposed | Email | System | Unplanned TTA Hub outage | All roles | The TTA Hub is temporarily down |  | Email · planned `systemUnplannedOutage` — not yet in EMAIL_ACTIONS |  |  |  |  | Do we have the ability to send this during an outage? Do we want this or keep our current process? |

---

## Maintenance

When the design spreadsheet (*TTA Hub Notifications.xlsx*) is updated:

1. Re-export to `notifications.json` (extraction script lives next to
   the sketch DSL).
2. Regenerate the six matrix tables above from the source JSON.
3. Diff against the previous version; add new rows, mark removed rows as
   obsolete (don't delete — preserves run history).
4. When pasting into Confluence, re-paste only the **spec columns** and
   preserve the execution-tracking columns (Logged-in as / Pass-Fail / Tester
   / Build / Notes) by editing in place, so a refresh doesn't wipe recorded
   results.
