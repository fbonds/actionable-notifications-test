# TTAHUB Actionable Notifications — Manual Test Plan DRAFT

> Paste this into the top-level Confluence page. Sub-sections that grow long
> (account roster, log-query cheatsheet, per-release spot-check log) belong on
> linked child pages rather than inline.

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

**Happy-path only.** This plan documents **happy-path verification only** —
that the correct notification fires with the right recipient, channel,
cadence, and content. **All negative testing** (suppression / non-delivery,
opt-out behavior, bystander checks, error and edge states) is performed
**ad hoc and is intentionally not documented** here or in the matrices.

## Approach

Two-layer manual process:

1. **Bulk verification via application-log inspection.** In lower
   environments, notification emails are not actually sent — the dispatch
   decision is logged. Testers trigger each scenario in the UI, then read the
   Cloud Foundry app logs via the `cf` CLI to confirm the right event fired
   with the right subject, recipient, channel, and cadence. This is the
   source of truth for ~150 of the variations.

   Log access (confirmed):

   ```
   cf login --sso
   cf logs <environment under test> --recent   # dump recent buffer
   cf logs <environment under test>            # tail live
   cf apps                                   # find the worker app — the
                                             # mailer likely runs there, not
                                             # in the web process
   ```

   `<environment under test>` = the CF app for the environment you're
   testing. See [`cf-cli-basics.md`](./cf-cli-basics.md) for the full list
   of values and which to use when (inter-sprint vs end-to-end vs RC).

   Logs are Winston JSON lines prefixed by a CF source tag
   (`[APP/PROC/WEB/0]`, `[RTR/n]`, `[APP/PROC/WORKER/0]`) with fields
   `level`, `message` (free text), `timestamp`, and a `label` taxonomy
   (`AUDIT` / `REQUEST` / `RTR`). There is **no** structured event
   envelope — checks grep the `message` string.

   **Confirmed with dev (2026-06-04).** Notification email jobs run in the
   **`WORKER`** process and emit these lines:

   - **Sent:** `Successfully sent <actionKey> notification for <REPORT-ID>`
     (e.g. `… collaboratorAssigned notification for R11-AR-63753`) — carries
     the action key **and report display id**.
   - **Human-readable:** `MAILER: Notifying users that report <REPORT-ID>
     was approved.`
   - **Suppressed:** `Did not send <actionKey> notification for <REPORT-ID>
     preferences are not set or marked as "no-send"`.
   - **Timing:** `notify<Action> <actionKey> execution time: Nms`.

   Key facts:
   - Logs at the **decision point** — *sent* and *suppressed* both log
     (with reason). A "Did not send … no-send" is expected when the
     recipient's prefs are off (see Preconditions).
   - **Recipient, subject, channel, and cadence are NOT logged.** The log
     confirms the action fired for a report id; recipient/subject are
     verified only via the spot-check inbox.
   - Grep handle: the **report display id** (isolates all activity for the
     report under test) and/or the action key.
   - **No remote trigger** for scheduled/digest notifications — local only
     (see Time-driven triggers).
   - **In-app** notifications: dev spoke strictly about emails; whether
     in-app logs at all is still open — in-app rows verify in the
     notification center for now.
2. **Spot-check real delivery in staging.** A short per-release checklist
   (~11 messages) sends to owned Gmail and Outlook inboxes to catch
   rendering and deliverability regressions that log inspection cannot.

## How we test the three core questions

| Question | Approach |
|---|---|
| **How do we test emails?** | Bulk: `cf logs` grep against the dispatch event. Spot-check: owned inboxes via the per-release checklist. |
| **How do we handle roles, approvers, etc.?** | **Self-provision at test time** from the team's **8 stable HSES test logins** (e.g. `test.tta.fletcher`) — these persist across refreshes; the tester assigns them the needed parts (Creator, Collaborator, Approver 1/2, POC, etc.) per scenario. Internal IDs, emails, grantee data, and report IDs **rotate on the weekend refresh** and are **never hardcoded** — capture them fresh each session. See *Preconditions* and *Test data & environment refresh*. |
| **How do we test email verification (arrival / rendering)?** | Covered by the spot-check checklist — testers visually inspect subject, body, links, and CTA in the actual inbox for the curated subset. Not attempted for the full 174. |

## Master test matrix

The 174 specs are split across six child pages — one per category — so each
page stays at a manageable size and matrix updates can be reviewed
independently:

| Child page | Source MD | Rows |
|---|---|---:|
| Test Matrix — Activity Reports | [matrix-activity-reports.md](./matrix-activity-reports.md) | 54 |
| Test Matrix — Collaboration Reports | [matrix-collaboration-reports.md](./matrix-collaboration-reports.md) | 50 |
| Test Matrix — Training Reports | [matrix-training-reports.md](./matrix-training-reports.md) | 53 |
| Test Matrix — Communication Logs | [matrix-communication-logs.md](./matrix-communication-logs.md) | 6 |
| Test Matrix — Other (Groups, Monitoring) | [matrix-other.md](./matrix-other.md) | 8 |
| Test Matrix — System (Outages) | [matrix-system.md](./matrix-system.md) | 3 |

Each page has the same columns:

- **Spec columns** (sourced from the design spreadsheet): ID, Status,
  Channel, Role (actor), Trigger, Received by, Expected subject /
  in-app content, CTA.
- **Execution helper**: pre-filled `cf logs … | grep` template — tester
  substitutes the expected recipient's id. **TBD (pending log capture):**
  the grep pattern and which id space to substitute (HSES vs internal).
  Currently the matrix files still hold the old Datadog syntax; they will
  be regenerated once one real notification line is captured.
- **Execution tracking**: Logged-in as, Pass / Fail, Tester, Build, Notes.

> When the design spreadsheet changes, regenerate the per-category MD
> files from the source JSON, then re-paste only the spec columns into
> Confluence — preserve the execution-tracking columns by editing in
> place. Alternative: keep spec table and execution table as two
> side-by-side Confluence tables joined by ID so re-imports are
> non-destructive.

## Two subsystems (different verification surfaces)

Per the build spike (TTAHUB-5339 + follow-ons), notifications split into two
subsystems with different verification surfaces:

- **Email** → the existing mailer; verify in **`cf` worker logs** (action
  keys / `Successfully sent …`).
- **In-app** → a new **`Notifications` DB table** behind the feature flag
  **`actionable_notifications`**; verify in the **notification center UI**
  (or query the table). The table stores `userId` (recipient), `type`,
  `text`, `link`, `viewedAt`, `archivedAt` — so in-app rows *can* verify
  recipient/content, unlike email logs. The in-app `NOTIFICATION_TYPE`
  values are TBD until implemented.

## Test data & environment refresh

The lower environments **including staging use obfuscated data that refreshes
on weekends** — users, internal IDs, emails, grantee data, and report IDs
present today are **not valid after the refresh**. The **only stable anchor**
is the team's **8 HSES test logins** (e.g. `test.tta.fletcher`), which persist
and are recreated in the Hub on login (with a *new* internal ID each refresh).

Consequences, baked into the plan:
- **Never hardcode** internal user IDs, emails, or report `displayId`s — they
  are session-scoped. Capture them fresh during setup, verify against the
  report you create *this session*.
- The **setup checklist below is re-run after each weekend refresh** (≈ every
  Monday), not "once."

## Preconditions (re-run each session / after each weekend refresh)

- **In-app:** the **`actionable_notifications` feature flag must be ON** in
  the environment under test (confirm per env).
- **Email:** a send only happens if the **recipient's** preferences allow it —
  otherwise the worker logs `Did not send … no-send` and nothing fires
  (expected, not a bug). For each HSES login you'll use as a recipient:
  - log in (this (re)creates the Hub user); **capture its current internal
    id**;
  - ensure a **qualifying role** (the email-preferences UI only appears for
    certain roles — e.g. ECM);
  - set its **email** to an inbox you own (you can set email for any account)
    and **verify** it;
  - set notification **preferences to send** for the event (default can be
    off).
- **Fixtures:** create the report(s)/relationships the scenario needs from
  these logins — don't rely on pre-existing data.

## Per-test execution flow

For each row in the matrix:

1. Start a log tail before triggering, pointed at the **worker** process.
   Grep by the report's display id to catch everything, and/or the row's
   action key — e.g.
   `cf logs <environment under test> | grep -E 'R01-AR-63792|changesRequested'`.
2. Log in as the *Role (actor)* using the account from the roster.
3. Perform the *Trigger* against a known fixture report (per-category
   fixtures listed on child pages).
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
  a state change = `deleteNotificationsByEntityAndType`; **30-day cutoff** =
  a scheduled cleanup job that deletes older notifications; users see **only
  their own**; admins create **global** notifications.
- **Header bell badge count** updates on new active notifications and
  decrements on dismissal.

> Negative/suppression behaviors (e.g. opt-out non-delivery, collaborator
> removed mid-flight, dismissal edge cases) are **not** part of the
> documented checks — they're handled ad hoc per the Scope note.

## Time-driven triggers — special handling

These cannot be triggered by a UI action and need a separate runbook
(child page, TBD with dev):

- TR 20-day "submit event details" reminder + 10-day repeat escalation.
- TR 20-day "submit session details" / "create a session" / "complete
  event" reminders.
- Monthly AR submission-deadline alert (5th working day of month).
- "AR pending approval for X days" alert.
- Monitoring daily digest (per region, only on net-new goals).
- Daily / weekly / monthly digest aggregation jobs.

**Approach — local Docker (confirmed).** Dev confirmed there is **no
remote mechanism** to fire scheduled vs immediate notifications on the CF
environments — *"if you want control, you'll need to do it locally."* So
these ~30 clock-dependent specs are tested against a **local Docker stack
on the tester's dev box**, where we can trigger the scheduled jobs directly
(invoke the cron/queue job, or seed reports with back-dated start/end dates
to trip the 20-day reminders) instead of waiting on the real schedule.
Implications:

- **Different log context:** inspect `docker compose logs -f worker`
  (local) instead of `cf logs` — same Winston lines and action keys, just
  a local source. The `cf-cli-basics.md` reference covers the CF side; a
  parallel local-Docker runbook is TBD.
- **Mail rendering bonus:** if the local stack includes a mail catcher
  (e.g. Mailpit / Mailcatcher), it may double as a rendering check for
  digests/reminders without needing real Gmail/Outlook delivery.

**Still to work out locally:** how to advance/trigger each scheduled job
(direct job invocation? npm task? DB clock knob?), and whether the local
cadence matches lower envs. This drives the local-Docker runbook (TBD).
(Event-driven specs remain on CF `cf logs` per the main execution flow.)

## Per-release spot-check (live email delivery)

Run in staging once per release. Goal is rendering and deliverability — not
coverage. Because data is obfuscated, **set the recipient HSES login's email
to an inbox you own** (Gmail/Outlook) during setup, then trigger — the email
lands in your inbox. Re-do after each weekend refresh.

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
  logs for `<environment under test>` and its worker app in the relevant
  lower env. Command reference + environment list:
  [`cf-cli-basics.md`](./cf-cli-basics.md).
- The team's **8 stable HSES test logins** (e.g. `test.tta.fletcher`) — the
  only data that survives the weekend refresh; used as all test actors.
- **Owned Gmail/Outlook inbox(es)** to point a login's email at for the
  spot-check rows (you can set email for any account).
- **Local Docker** for the time-driven specs (no remote trigger exists).

## Maintenance

When the design spreadsheet is updated:

1. Re-export to `notifications.json` (extraction script lives next to
   the sketch DSL).
2. Regenerate the per-category MD files (`matrix-*.md`).
3. Diff against the previous version; add new rows to Confluence,
   mark removed rows as obsolete (don't delete — preserves run history).
