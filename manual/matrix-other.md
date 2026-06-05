# Test Matrix — Other (Groups, Monitoring) DRAFT

> Source of truth: design spreadsheet *TTA Hub Notifications.xlsx*.
> Regenerate this page when the spec changes — see the top-level test plan for maintenance notes.

**Rows:** 8 · **Verify** column (per TTAHUB-5383 / PR #3665):

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
| Misc-1a | Draft | In-app | System | Adds/opens a monitoring goal | TTACs & Managers | New monitoring goals for recipients in your region are available. | View goals | In-app · `Notifications.type=monitoringGoalAdded` (flag on) |  |  |  |  | Will trigger when the monitoring goal is added to the RTR for the first iteration and any subsequent re-opens. Original content: "A monitoring goal for [Recipient name] is available in the TTA Hub." |
| Misc-1a | Proposed | In-app | System | New monitoring data was received. | TTACs & Managers | New monitoring details for [Recipient name] are available. | View details | In-app · `Notifications.type=monitoringDataReceived` (flag on) |  |  |  |  | Replaced monitoring goal language in row 159 & 160 |
| Misc-1b | Draft | Email | System | Adds/opens a monitoring goal | TTACs & Managers | New monitoring goals added for recipients in your region. |  | Email · planned `monitoringGoalAdded` — not yet in EMAIL_ACTIONS |  |  |  |  | We don't know what TTAC or Manager is associated with each recipient, do we? Phase 2? Original content: "Monitoring goal added for [Recipient name]. |
| Misc-1b | Proposed | Email | System | New monitoring data was received. | TTACs & Managers | New monitoring details were added for recipients in your region. |  | Email · planned `monitoringDataReceived` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| Misc-2a | Proposed | In-app | Group Creator | Adds a co-owner to "my group" | Group Co-owner | [Creator's name] added you as a co-owner of the group: [Group name]. |  | In-app · `Notifications.type=groupCoOwnerAdded` (flag on) |  |  |  |  |  |
| Misc-2b | Proposed | Email | Group Creator | Adds a co-owner to "my group" | Group Co-owner | Group [Group name]: Added as co-owner |  | Email · planned `groupCoOwnerAdded` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| Misc-3a | Proposed | In-app | Group Creator | Shares their "my group" | Group receiver | [Creator's name] shared the group: [Group name] with you. |  | In-app · `Notifications.type=groupShared` (flag on) |  |  |  |  |  |
| Misc-3b | Proposed | Email | Group Creator | Shares their "my group" | Group receiver | Group [Group name]: shared with you |  | Email · planned `groupShared` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
