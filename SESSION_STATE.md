# Session State — TTAHUB Actionable Notifications Test Planning DRAFT

**Last updated:** 2026-06-01
**Status:** Active. Log-access mechanism confirmed and corrected (it's
Cloud Foundry / `cf` CLI, NOT Datadog). First real log capture analyzed.
Resume from "Next actions" below.

## Conventions

- **Document titles end in `DRAFT` (all caps)** while in draft status —
  applies to every titled doc in this repo (the H1). Carry this into any
  new doc created here, and strip `DRAFT` only when a doc is finalized.

## Project context

Early exploration of test planning for OHS TTAHUB's expanded Actionable
Notifications feature. The feature defines ~174 distinct notification
variations across Activity Reports, Collaboration Reports, Training
Reports, Communication Logs, and System/Other (group, monitoring, outage)
categories — each variation a unique combination of trigger × channel
(in-app | email) × recipient role.

Working folder: `/Users/fletcherbonds/code/actionable-notifications-test/`

## Source materials reviewed

All in the working folder root:

- `actionable-notifications-master-design.png` — Figma master overview
- `screenshot1of11.png` through `screenshot11of11.png` — individual Figma
  screens covering homepage entry, notifications page (Active/Archived),
  preferences page with all category sections, monitoring CTA flow, etc.
- `Actionable Notifications email content.pdf` — 55 pages, ~80 email
  templates (subject + body) covering AR, CR, TR, CL, and Misc/System
- `TTA Hub Notifications.xlsx` — design spreadsheet, 174 spec rows. This
  is the canonical source of truth for the test matrix.

## Log access (CONFIRMED 2026-06-01) — replaces the Datadog assumption

Logs are pulled from the Cloud Foundry app instances with the `cf` CLI,
not Datadog.

Setup + usage:

```
brew install cloudfoundry/tap/cf-cli@8
cf login --sso
cf logs <environment under test> --recent   # dump recent buffer
cf logs <environment under test>            # tail live
```

Environments (CF app names; commands identical for each):

- `tta-smarthub-staging` (staging)
- `tta-smarthub-dev-blue`
- `tta-smarthub-dev-gold`
- `tta-smarthub-dev-green` (notification captures to date used this one;
  host `tta-smarthub-dev-green.app.cloud.gov`, login via HSES staging OIDC)
- `tta-smarthub-dev-pink`
- `tta-smarthub-dev-red`

The five color-named `dev-*` apps are per-developer environments (each dev
is assigned one). Full command reference: `manual/cf-cli-basics.md`.

**When to use which (this feature):**

- **Inter-sprint check-ins** → the assigned dev's color. The dev primarily
  responsible for THIS release is on **`tta-smarthub-dev-blue`**, so that's
  the env to tail for the redesign's notification events as they land.
- **End-to-end testing** → **local Docker** (default).
- **Release candidates** (all implementation done; polishing / final
  bug-hunt) → one of the dev colors **or** `tta-smarthub-staging`.

### Real log shape (replaces the assumed event schema)

Logs are **Winston JSON lines**, prefixed by the CF source tag
(`[APP/PROC/WEB/0]`, `[RTR/n]`, etc.). Fields seen:

- `level` — `info` | `debug`
- `message` — **free text** (e.g. "getApprovers execution time: 46ms",
  "UserInfo Response", "HTTP GET /api/...")
- `timestamp` — ISO 8601 (UTC)
- `label` — taxonomy tag: `AUDIT`, `REQUEST` (and router `RTR` lines)
- plus contextual fields per message (e.g. `userId`, `regions`, `meta.req`)

There is **NO** structured `{event, notification_id, recipient_user_id,
channel, cadence, subject, suppressed}` envelope. Notification checks
**grep the `message` string**, not named fields.

### Confirmed notification log lines (dev — Matt B., 2026-06-04)

Email notifications emit several lines from the **`WORKER`** process
(`[APP/PROC/WORKER/0]`). The useful ones:

- **Sent:** `Successfully sent <actionKey> notification for <REPORT-ID>`
  (e.g. `… collaboratorAssigned notification for R11-AR-63753`) — confirms
  the send; carries the **action key + report display id**.
- **Human-readable:** `MAILER: Notifying users that report <REPORT-ID>
  was approved.`
- **Suppressed:** `Did not send <actionKey> notification for <REPORT-ID>
  preferences are not set or marked as "no-send"` — the decision logs
  **even when nothing is sent**, with the reason.
- **Timing:** `notify<Action> <actionKey> execution time: Nms`.

Confirmed implications:

- Logging is at the **decision point** — sent *and* suppressed both log
  (suppression reason included). Not SMTP-only.
- **Recipient is NOT logged** (confirmed). Cannot verify *who* received it
  from logs — confirm recipient via the spot-check inbox / notification
  center.
- **No remote trigger** for scheduled/digest notifications — must be done
  locally (see time-driven testing).
- Best grep handle: the **report display id** (isolates all activity for
  the report under test) and/or the action key (surfaces the
  sent/suppressed/timing lines together).

Practical filter:

```
cf logs <environment under test> | grep -iE 'sent|did not send|MAILER|notif'
```

### Email-preferences precondition (CRITICAL for happy-path)

A send only happens if the **recipient's** notification preferences are
set to send. Two gotchas confirmed with dev:

1. The email-preferences UI only appears for a user in a **qualifying
   role** (e.g. ECM). Other roles can't set prefs.
2. If prefs are unset or "no-send" you get `Did not send … preferences are
   not set or marked as "no-send"` and **no email fires** — looks like a
   failure but is expected.

So before testing a happy-path **email** row, the recipient account must
have a qualifying role, a **verified email**, and prefs set to send. (Our
`test.tta.fletcher` was defaulting to notifications **off**, which is why
the first send attempt logged "Did not send".)

**Asymmetry (PR #3673):** this pref-gating is **email-only**. The in-app
`createNotification` service does **not** check preferences — so in-app
notifications are not pref-gated at the service level (gating, if any, would
be at the call site — TBD). Don't assume an in-app row is suppressed just
because email prefs are off.

### Two distinct user-ID spaces (recipient NOT in logs — see above)

- **HSES id** = `userId 55815` (`sub: test.tta.fletcher`,
  `email: 55815@hsesinfo.org`) — from the OIDC UserInfo response.
- **Internal TTA Hub DB id** = `userId 872` — appears in the API
  request `meta`.

Recipient isn't logged, so neither id verifies a send from logs. The two
ids still matter for the roster and for spot-check / notification-center
confirmation of who received what. Keep a roster mapping HSES id ↔
internal id ↔ email ↔ role.

### Test persona note

`test.tta.fletcher` is a **federal / Region 0** account
(`ROLE_FEDERAL`). This limits which specs the persona can trigger;
some specs need region-scoped or non-federal roles.

## New notification system (spike tickets — TTAHUB-5339 + follow-ons)

The spike defines the expanded system being built **this PI behind a
short-lived feature flag `actionable_notifications`**. There are **two
subsystems**:

**1. In-app notifications = a new `Notifications` DB table** (TTAHUB-5383).
Columns: `userId` (FK, nullable), `entityId` (polymorphic — group /
communicationLog / activityReport / collabReport / trainingReport /
sessionReport), `type` (`NOTIFICATION_TYPE` enum), `link`, `label`, `text`,
`viewedAt`, `archivedAt` (timestamps; `paranoid:false`). Migration ships
the flag + seeded dev data.
→ **In-app verification = the notification center UI (or query the
`Notifications` table) — NOT `cf logs`.** The table stores the recipient
(`userId`), type, text, and link — richer than email logs.

**2. Email notifications = the existing mailer** (`EMAIL_ACTIONS`), being
made config-driven so new ones are plug-and-play (TTAHUB-5390). Verified
via `cf` worker logs as already documented.

Services — **as actually built in PR #3673** (note: differs from the
ticket text in places):

- `createNotification(userId, entityId, type, {metadata})` — looks up
  `NOTIFICATION_CONFIGURATION[type]`; **throws** `No notification
  configuration found for type <t>` if absent; else builds text / link /
  label / displayId from the config's `*Fn`s and inserts a row.
  ⚠️ **It does NOT check user preferences** (the ticket said it would —
  the impl doesn't). So in-app creation is not pref-gated in the service.
- `createGlobalNotification(type, {metadata})` — same, with `userId` null
  (⇒ `isGlobal`); used for system/outage "all roles".
- `updateNotification(notification, changes)` — allow-lists **only
  `archivedAt`, `triggeredAt`, `viewedAt`**; all other fields (text, type,
  …) are ignored. This is dismiss / mark-read / mark-triggered.
- `deleteNotification(scopes)` — `destroy` where AND of scopes; called by
  the scheduled cleanup job **or** by a handler when a user action
  invalidates a notification (e.g. a report is "un-submitted"). This is the
  stale auto-clear.
- `getNotifications(scopes, {limit=10, offset=0, sortBy='triggeredAt',
  sortDirection='DESC'})` — paginated (10/page), default sort triggeredAt
  DESC.

🔴 **Big testability constraint:** `NOTIFICATION_CONFIGURATION` in this PR
has **only TWO entries** — `ACTIVITY_REPORT_NEEDS_ACTION` and
`SYSTEM_PLANNED_OUTAGE`. Every other enum type **throws** on
`createNotification` until its config is registered (per-notification
tickets). So although the enum lists 36 types, only those 2 in-app
notifications can be created today — and even those need a call site wiring
them in. Watch for `NOTIFICATION_CONFIGURATION` growing.

API (TTAHUB-5387): create/delete are **programmatic only** (no handler);
update/get have handlers — users see/update **only their own**; admins
create global. Type filter (TTAHUB-5386) options: **Activity Report,
Training Report, Collaboration Report, System Related, Other** — note **no
separate "Communication Log" filter**, so our 6th matrix category likely
folds under Other/System in the FE (reconcile).

Cleanup (TTAHUB-5389): a scheduled job **deletes notifications older than
30 days** (the Figma 30-day archive window).

**Testing implications:**
- The **`actionable_notifications` flag must be ON** to see/test the new
  in-app system (confirm per env; likely toggled on dev-blue as work lands).
- In-app rows → notification center / `Notifications` table (has recipient);
  email rows → `cf` worker logs. Two separate surfaces.
- The specific **`NOTIFICATION_TYPE` enum values** are now known — see **PR
  #3665** (`src/constants.js` `NOTIFICATION_TYPES`, the migration enum array,
  and the `specs/actionable-notifications/index.md` CSV-row→enum-key
  inventory). All six matrices' `Verify` columns are populated from it.
- **Schema details (PR #3665):** `Notifications` columns include `userId`
  (null ⇒ **global**, exposed as virtual `isGlobal`), `entityId`, `type`
  (enum), `displayId` (the `R01-AR-1234`-style report id shown in the UI's
  2nd column), `link`, `label`, `text`, `triggeredAt` (null ⇒ virtual
  `isInformational`), `viewedAt`, `archivedAt`. Seeded dev data + the
  `actionable_notifications` flag ship in the migration.
- **Caveat (updated for PR #3673):** PR #3665 adds the in-app types + table;
  PR #3673 adds the **services** (above). But emails for new types still
  aren't wired (`EMAIL_ACTIONS` unchanged), `NOTIFICATION_CONFIGURATION`
  covers only 2 types, and **nothing yet calls `createNotification`** from
  real app flows (that's per-notification + handler tickets). So a defined
  `type` ≠ it fires yet. The currently end-to-end-testable surface remains
  the **existing email actions** (AR family + the 5 `trainingReport*`); new
  in-app/email rows light up as call sites + config land on dev-blue.

## Key decisions made this session

1. **Manual process, not automated** — user pivoted from the initial
   automated-DSL sketch toward a manual approach as the first deliverable.
   Automation may follow later.
2. **App-log inspection is the source of truth for ~150 specs.** In
   lower envs the dispatch decision is logged. Testers read the logs to
   confirm the right **email event/action fired** (by action key + report
   display id, sent vs suppressed).
   **CORRECTION (2026-06-01): logs come from Cloud Foundry via the `cf`
   CLI, NOT Datadog.** **REFINED (2026-06-04):** logs confirm the *action*
   and *report id* and whether it was sent/suppressed — but **subject,
   recipient, channel, and cadence are NOT in the logs**; those are
   verified via the spot-check inbox, not logs. See "Log access" for the
   confirmed lines.
3. **Spot-check real delivery for ~11 representative messages per release**
   against owned Gmail/Outlook accounts. "Email verification" in the
   original ask = this rendering/delivery spot-check, nothing more.
4. **Confluence is the destination.** All deliverables produced as MD files
   here; user pastes them into Confluence manually (no API access for
   Claude to push directly).
5. **Test matrix split per category** — six MD files, one per category,
   rather than a single 174-row table. Each maps 1:1 to a Confluence
   child page.
6. **Happy-path verification only** (2026-06-04). The documented plan
   covers happy-path verification — the correct notification fires with
   the right recipient, channel, cadence, and content. **All negative
   testing** (suppression / non-delivery, opt-out, bystander, error/edge
   states) is **ad hoc and intentionally undocumented** in the plan and
   matrices. Removed from the plan accordingly: the bystander roster
   account, the negative-case step in the execution flow, and the
   preference-change / collaborator-removed suppression checks.

## Artifacts produced

### Manual (the active deliverable set — `manual/`)

- `manual/test-plan.md` — top-level Confluence page. Scope, approach,
  three-questions-answered, per-test execution flow, cross-cutting
  checks, spot-check shortlist (11 messages), known open spec
  questions, maintenance notes.
- `manual/matrix-activity-reports.md` — 54 rows
- `manual/matrix-collaboration-reports.md` — 50 rows
- `manual/matrix-training-reports.md` — 53 rows
- `manual/matrix-communication-logs.md` — 6 rows
- `manual/matrix-other.md` — 8 rows (groups + monitoring)
- `manual/matrix-system.md` — 3 rows (outages)

Each matrix file = a Confluence-ready MD table with 14 columns:
spec columns + pre-filled query template + empty execution-tracking
columns (Logged-in as, Pass/Fail, Tester, Build, Notes).
**Verify column COMPLETE across all six matrices (2026-06-04).** Column is
now `Verify (in-app table / email log)`; every row mapped to its real
identifier using the **PR #3665 / TTAHUB-5383** enum + inventory (no more
guesses, no `TBD` for known rows). Scheme:

- **In-app** rows → `Notifications.type=<enumValue>` (query the table /
  notification center; flag `actionable_notifications` ON). Enum values
  taken from `src/constants.js` `NOTIFICATION_TYPES` (full list in PR).
- **Email** rows, **wired today** (value in current `EMAIL_ACTIONS` — the
  AR approval family + AR digests + `trainingReportCollaboratorAdded`,
  `trainingReportSessionCreated`, `trainingReportEventCompleted`,
  `trainingReportTaskDueNotifications`, `trainingReportEventImported`) →
  `cf logs … | grep '<value>'`.
- **Email** rows, **planned/not-yet-wired** (CR all, CL all, monitoring /
  group / system, new TR session/POC, AR-14/15 + all non-AR digests) →
  marked "planned `<key>` — not yet in `EMAIL_ACTIONS`". This PR adds the
  in-app types + table; it does **NOT** wire the new emails (that's
  TTAHUB-5390 + per-notification tickets).
- **Paused** rows → "Out of scope (Paused)".

So the prior `TBD`s are resolved: AR-14/15 = `ACTIVITY_REPORT_*_DIGEST`
(planned email); CR = `collabReport*` (in-app live once flag/services land,
email planned); TR session/POC = `trainingReport*`; CL/monitoring/group/
system all have named types. Remaining real unknown: exact send-time email
wiring per new type (future tickets).

### Automated (parked sketch — `sketch/`)

Built earlier in the session before the pivot to manual. Kept for
future reference if automation is added later.

- `sketch/fixtures/notifications.json` — all 174 specs extracted from
  the XLSX. **Still useful** as the regeneration source for the
  manual MD files.
- `sketch/lib/notifications.js` — automated DSL: `expectNotification`,
  `expectNoNotification`, `expectQueuedForDigest`, `expectDigest`,
  `forEachSpec`. Wraps Datadog Logs Search API.
- `sketch/specs/ar-changes-requested.spec.js` — example spec covering
  the AR-6 fan-out + a parameterized matrix-runner example.

## Open questions / blockers (resolve before completion)

Carried over from the design spec; flagged in `manual/test-plan.md`:

1. **Misc-1b** — TTAC/Manager-to-recipient mapping not yet defined.
   Blocks ~10% of the matrix until routing is decided.
2. **CL-2** — "Anyone with a group or just Program Specialists?"
3. **TR-6a** — "Do Collaborating Specialists submit TRs?"
4. **Misc-5a** — Can the unplanned-outage email be sent during an
   outage?
5. **Dismissal logic — RESOLVED (spike TTAHUB-5384).** State changes
   **auto-invalidate** logically-related notifications via
   `deleteNotificationsByEntityAndType` — so it's not purely
   per-notification. User dismiss/mark-read = `updateNotification`
   (`viewedAt`/`archivedAt`); programmatic stale-cleanup deletes related
   ones. 30-day archive = scheduled cleanup job (TTAHUB-5389).
6. **Time-trigger testing — likely local Docker** (updated 2026-06-04).
   The ~30 clock-dependent specs (digests, 20-day reminders, monthly
   deadline / pending-approval alerts, monitoring daily digest) will
   probably be tested on a **local Docker stack on the dev box** rather
   than CF, since scheduled jobs can be triggered directly locally
   (invoke the job, or seed back-dated reports) instead of waiting on the
   real schedule. This creates a **second log context**: `docker compose
   logs` locally vs `cf logs` for event-driven specs (same Winston lines
   / action keys). **Confirmed with dev (2026-06-04): there is NO remote
   mechanism to trigger scheduled vs immediate notifications — "if you want
   control, you'll need to do it locally."** So local Docker is the
   approach, not a maybe. Still to work out locally: how to advance/trigger
   each scheduled job (invoke job / seed back-dated reports / clock knob).
   A local-Docker runbook is TBD.
7. **Notification log line — RESOLVED with dev (2026-06-04).** See the
   "Confirmed notification log lines" section above. Net: WORKER process;
   `Successfully sent <action> notification for <REPORT-ID>` / `Did not
   send … no-send` / `MAILER:` / timing lines; logs at the decision point
   (sent + suppressed both log, with reason); **recipient NOT logged**;
   subject/channel/cadence NOT logged. **No remote trigger** for scheduled
   notifications — local only.
   Remaining sub-questions:
   - **In-app verification — RESOLVED:** in-app is the new `Notifications`
     DB table (not mailer logs); verify via the notification center /
     table, behind the `actionable_notifications` flag. See "New
     notification system" above.
   - The `EMAIL_ACTIONS` list (AR + TR email) **will grow** and becomes
     config-driven (TTAHUB-5390). The spike tickets give the **system
     design** but **not the concrete `NOTIFICATION_TYPE` enum values or new
     email action keys** — those come from the implementation. Pull them to
     fill the `TBD` / "not yet implemented" matrix cells (in-app `type` and
     CR/CL/monitoring/groups/digest actions).

## Confirmed answers

- Test matrix lives in **Confluence (wiki page)**.
- "Email verification" = **just verifying email arrived/rendered**
  (i.e. the spot-check layer, not a separate flow).
- **Logs come from Cloud Foundry via the `cf` CLI** (NOT Datadog —
  corrected 2026-06-01). Winston JSON; `label` taxonomy (`AUDIT`,
  `REQUEST`, `RTR`).
- **Notification logging confirmed with dev (2026-06-04):** WORKER process;
  `Successfully sent <action> notification for <REPORT-ID>` / `Did not send
  … no-send` / `MAILER:` / timing lines; logs at the **decision point**
  (sent + suppressed both log, with reason); **recipient NOT logged**;
  subject/channel/cadence NOT logged.
- **No remote trigger for scheduled notifications** — local only.
- **Email-preferences precondition:** sends require the recipient to have a
  qualifying role + verified email + prefs set to send; otherwise logs
  "Did not send … no-send" and nothing fires.
- **`EMAIL_ACTIONS` will grow** with this feature; new action keys are in
  the linked Jira tickets.
- Two user-ID spaces exist (HSES id vs internal TTA Hub id) — but recipient
  is **not** in logs, so the ids are for roster / inbox confirmation only.

## Next actions (pick up here on resume)

User had asked which of four MD follow-ups to draft next. None
selected yet. All would be MD files in `manual/`:

1. **Test account roster template** — Confluence child page with a table
   per lower env (dev, staging) listing test users by role, with
   placeholders for email, user ID, password reference, group
   membership.
2. **`cf logs` log-check cheatsheet** — copy-pasteable grep templates
   (by report id, by action key, sent vs "did not send", `MAILER:` lines)
   plus the email-preferences precondition checklist. (Was "Datadog
   cheatsheet" — Datadog is not used.)
3. **Spot-check execution log template** — per-release page where
   testers capture results for the 11-message shortlist with
   screenshots. (This is also where recipient/subject get verified, since
   logs don't carry them.)
4. **Local-Docker runbook** — for the ~30 time-driven specs; document how
   to trigger each scheduled job locally (confirmed: no remote mechanism).

Immediate next steps (highest value):

- **DONE:** enum + inventory extracted from PR #3665 and applied to all six
  matrices' `Verify` columns.
- **Set up a qualifying-role test account with prefs ON** (email verified)
  so happy-path email rows actually send rather than logging "Did not
  send". (Matt set `test.tta.fletcher` as ECM on dev-blue as an example.)
- **Confirm `actionable_notifications` flag is ON** on dev-blue, then verify
  the in-app rows against the `Notifications` table / notification center as
  the create-services (TTAHUB-5384) land.
- **Re-pull the enum if it changes** — additional per-notification tickets
  will register new emails/types; the matrices regenerate from the same
  PR-style mapping.

Also worth doing on resume:

- Get user to **pick which follow-up** (or all) to produce next.
- When the design XLSX is updated, **regenerate** the MD matrix files
  from `sketch/fixtures/notifications.json` (run the extraction shown
  in `manual/test-plan.md` maintenance section).

## How to resume

1. Read this file.
2. Read `manual/test-plan.md` for the canonical plan as it stands.
3. Sample one matrix MD file (e.g. `manual/matrix-system.md` — shortest)
   to recall the table format.
4. Ask the user which follow-up to draft next, or whether the open
   questions have been resolved.
