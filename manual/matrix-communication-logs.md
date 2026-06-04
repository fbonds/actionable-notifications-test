# Test Matrix — Communication Logs DRAFT

> Source of truth: design spreadsheet *TTA Hub Notifications.xlsx*. 
> Regenerate this page when the spec changes — see the top-level test plan for maintenance notes.

**Rows:** 6 · **Verify** column (per TTAHUB-5383 / PR #3665):

> - **In-app** rows → look for a row in the `Notifications` table (or the
>   notification center) with the given `type` and the report's `displayId`;
>   requires the **`actionable_notifications`** feature flag ON.
> - **Email** rows → `cf logs <environment under test> | grep` the action key
>   where **wired** (fires today); rows marked *planned* are not in
>   `EMAIL_ACTIONS` yet (emails for new types ship later — TTAHUB-5390 +
>   per-notification tickets).
> - Email logs carry **no recipient/subject** (the table has `userId`); confirm
>   those via the per-release spot-check. **Paused** rows are out of scope.
>   `<environment under test>` per [`cf-cli-basics.md`](./cf-cli-basics.md).
> - **In-app firing is gated by `NOTIFICATION_CONFIGURATION`** — as of PR
>   #3673 only `ACTIVITY_REPORT_NEEDS_ACTION` and `SYSTEM_PLANNED_OUTAGE`
>   are configured; other `type`s throw until registered, and a call site
>   must invoke `createNotification`. So most in-app rows aren't creatable
>   yet — they light up as config + call sites land.

| ID | Status | Channel | Role (actor) | Trigger | Received by | Expected subject / in-app content | CTA | Verify (in-app table / email log) | Logged-in as | Pass / Fail | Tester | Build | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CL-1a | Proposed | In-app | Creator | Adds Other TTA staff to a Comm Log | TTA staff | [Creator's name] added you as TTA staff on their Communication Log for [Recipient name]. |  | In-app · `Notifications.type=communicationLogTtaStaffAdded` (flag on) |  |  |  |  |  |
| CL-1b | Proposed | Email | Creator | Adds Other TTA staff to a Comm Log | TTA staff | Communication Log R14-CL-12345: Added as TTA staff |  | Email · planned `communicationLogTtaStaffAdded` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CL-2a | Proposed | In-app | Creator | A Comm Log was entered for a recipient in a group | Program Specialist | A Communication Log was entered for your recipient: [Recipient name] from the group: [My Group name]. |  | In-app · `Notifications.type=communicationLogRecipientInGroup` (flag on) |  |  |  |  | Anyone with a group or just Program Specialists? |
| CL-2b | Proposed | Email | Creator | A Comm Log was entered for a recipient in a group | Program Specialist | Communication Log R14-CL-12345: Entered for the recipient: [Recipient name] from group: [Group name] |  | Email · planned `communicationLogRecipientInGroup` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CL-3 | Proposed | Email | Digest | Added as TTA staff on a Comm log | TTA staff | Subject: TTA Hub [daily/weekly/monthly] digest: added as TTA staff on a Communication log |  | Email digest · planned `COMMUNICATION_LOG_TTA_STAFF_ADDED_DIGEST` — not yet wired |  |  |  |  |  |
| CL-4 | Proposed | Email | Digest | Comm log added for a recipient in "My group" | Program Specialist | Subject: TTA Hub [daily/weekly/monthly] digest: Communication log added for a recipient in one of your groups |  | Email digest · planned `COMMUNICATION_LOG_RECIPIENT_IN_GROUP_DIGEST` — not yet wired |  |  |  |  |  |
