# Test Matrix — System (Outages) DRAFT

> Source of truth: design spreadsheet *TTA Hub Notifications.xlsx*. 
> Regenerate this page when the spec changes — see the top-level test plan for maintenance notes.

**Rows:** 3 · **Verify** column (per TTAHUB-5383 / PR #3665):

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
| Misc-4a | Proposed | In-app | System | TTA Hub planned outage | All roles | Planned outage: the TTA Hub will be closed for maintenance from [date through date]. |  | In-app · `Notifications.type=systemPlannedOutage` (flag on) |  |  |  |  |  |
| Misc-4b | Proposed | Email | System | TTA Hub planned outage | All roles | TTA Hub scheduled outage [day, month, day] |  | Email · planned `systemPlannedOutage` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| Misc-5a | Proposed | Email | System | Unplanned TTA Hub outage | All roles | The TTA Hub is temporarily down |  | Email · planned `systemUnplannedOutage` — not yet in EMAIL_ACTIONS |  |  |  |  | Do we have the ability to send this during an outage? Do we want this or keep our current process? |
