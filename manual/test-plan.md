# TTAHUB Actionable Notifications — Manual Test Plan DRAFT

> Paste this into the top-level Confluence page. Sub-sections that grow long
> (session setup checklist, per-release spot-check log, local-Docker runbook)
> belong on linked child pages rather than inline.

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

This plan and the matrices verify that the **correct notification fires with
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

`<environment under test>` = the CF app for the environment under test — see
[`cf-cli-basics.md`](./cf-cli-basics.md) for the list and which to use when.

### Log shape

Winston JSON lines prefixed by a CF source tag (`[APP/PROC/WEB/0]`,
`[RTR/n]`, `[APP/PROC/WORKER/0]`), with fields `level`, `message` (free
text), `timestamp`, and a `label` taxonomy (`AUDIT` / `REQUEST` / `RTR`).
There is **no** structured event envelope — checks grep the `message` string.

### Notification lines (email — confirmed with dev, 2026-06-04)

Email jobs run in the **`WORKER`** process and emit:

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
  report under test) and/or the action key.
- **No remote trigger** for scheduled/digest notifications — local only (see
  *Time-driven triggers*).
- **In-app notifications don't appear here** — they're rows in the
  `Notifications` table; verify via the notification center (see
  *Two subsystems*).

## How we test the three core questions

| Question | Approach |
|---|---|
| **How do we test emails?** | Bulk: `cf logs` grep against the dispatch event. Spot-check: owned inboxes via the per-release checklist. |
| **How do we handle roles, approvers, etc.?** | **One login (your own) + the admin tool.** For any other party a scenario needs, use the admin tool to set that user's role / region / permissions / email and to **impersonate** them for their trigger (or self-serve where the flow allows). No second human or shared login. Full mechanics in *Test data & environment refresh* and *Preconditions*. |
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
- **Verify** column: per row, the in-app `Notifications.type` or the email
  `cf logs … | grep` (action key / report `displayId`) — see each matrix's
  intro note for the live-vs-planned scheme.
- **Execution tracking**: Logged-in as, Pass / Fail, Tester, Build, Notes.

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
  recipient/content, unlike email logs. Each matrix row's in-app `type` is
  filled from `NOTIFICATION_TYPES`; firing is gated by
  `NOTIFICATION_CONFIGURATION` (only 2 types wired so far — see matrix notes).

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
  logs for `<environment under test>` and its worker app in the relevant
  lower env. Command reference + environment list:
  [`cf-cli-basics.md`](./cf-cli-basics.md).
- **Your own HSES login** (e.g. `test.tta.fletcher`) — the one reliable
  identity in every env (the shared team logins are off-limits in the lowers).
- **Admin tool** — to set any user's role / region / permissions / email and
  to **impersonate** them for multi-party triggers.
- **Owned Gmail/Outlook inbox(es)** to point a recipient's email at for the
  spot-check rows.
- **Local** runs against **imported production data** (no obfuscation).
- **Local Docker** for the time-driven specs (no remote trigger exists).

## Maintenance

When the design spreadsheet is updated:

1. Re-export to `notifications.json` (extraction script lives next to
   the sketch DSL).
2. Regenerate the per-category MD files (`matrix-*.md`).
3. Diff against the previous version; add new rows to Confluence,
   mark removed rows as obsolete (don't delete — preserves run history).
