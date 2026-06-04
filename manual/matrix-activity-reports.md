# Test Matrix — Activity Reports DRAFT

> Source of truth: design spreadsheet *TTA Hub Notifications.xlsx*. 
> Regenerate this page when the spec changes — see the top-level test plan for maintenance notes.

**Rows:** 54 · **Verify** column (per TTAHUB-5383 / PR #3665):

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
|  | Out of scope | In-app | System | Near report submission deadline (5th working day of the month) | Creator | The submission deadline for Activity Report R01-AR-17967 is near. | Take action |  |  |  |  |  | NEW - Wishlist item 03/24/26 Digest? |
|  | Out of scope | Email | System | Near report submission deadline (5th working day of the month) | Creator | Submit draft Activity Report R01-AR-17967: Submission deadline 07/05/2026 |  |  |  |  |  |  | Version 2 per Heather - https://adhoc.slack.com/archives/C022R5301L4/p1774474899507799 |
|  | Out of scope | In-app | System | Near report submission deadline (5th working day of the month) | Collaborator | The submission deadline for Activity Report R01-AR-17967 is near. | Take action |  |  |  |  |  |  |
|  | Out of scope | Email | System | Near report submission deadline (5th working day of the month) | Collaborator | Submit draft Activity Report R01-AR-17967: Submission deadline 07/05/2026 |  |  |  |  |  |  |  |
|  | Out of scope | In-app | System | Activity Report pending approval for "X' days | TTAC/Managers | An Activity Report for [Recipient name] has been pending approval for "X" days. | View AR |  |  |  |  |  | NEW - Wishlist item 03/24/26 Digest? |
|  | Out of scope | Email | System | Activity Report pending approval for "X' days | TTAC/Managers | Activity Report R01-AR-17967: Pending approval for "X" days |  |  |  |  |  |  | Version 2 - https://adhoc.slack.com/archives/C022R5301L4/p1774474899507799 |
| AR-10a | Proposed | Email | Digest | Activity Reports for review | Approvers | TTA Hub [daily/weekly/monthly] digest: Activity Reports for approval |  | `cf logs <environment under test> \| grep -E 'approverAssignedDigest\b'` |  |  |  |  | Digest |
| AR-11 | Proposed | Email | Digest | Activity Reports need action | Creator/Collaborator | TTA Hub [daily/weekly/monthly] digest: Activity Report changes requested |  | `cf logs <environment under test> \| grep -E 'changesRequestedDigest\b'` |  |  |  |  |  |
| AR-12 | Proposed | Email | Digest | Activity Reports - approved | Creator/Collaborator | TTA Hub [daily/weekly/monthly] digest: approved Activity Reports |  | `cf logs <environment under test> \| grep -E 'reportApprovedDigest\b'` |  |  |  |  |  |
| AR-13 | Proposed | Email | Digest | Added as a Collaborator | Collaborator | TTA Hub [daily/weekly/monthly] digest: added as collaborator on Activity Reports |  | `cf logs <environment under test> \| grep -E 'collaboratorDigest\b'` |  |  |  |  |  |
| AR-14 | Proposed | Email | Digest | Creator submits AR where I'm the Collab | Collaborator | TTA Hub [daily/weekly/monthly] digest: Activity Reports submitted for approval |  | Email digest · planned `ACTIVITY_REPORT_SUBMITTED_TO_COLLABORATOR_DIGEST` — not yet wired |  |  |  |  |  |
| AR-15 | Proposed | Email | Digest | Collab submits a report for approval | Creator | TTA Hub [daily/weekly/monthly] digest: Activity Reports submitted for approval |  | Email digest · planned `ACTIVITY_REPORT_COLLABORATOR_SUBMITTED_DIGEST` — not yet wired |  |  |  |  |  |
| AR-1a | Proposed | In-app | Creator | Adds a Collaborator | Collaborator | [Creator's name] added you as a Collaborator on their Activity Report for [Recipient name]. | View AR | In-app · `Notifications.type=collaboratorAssigned` (flag on) |  |  |  |  |  |
| AR-1b | Published | Email | Creator | Adds a Collaborator | Collaborator | Activity Report R01-AR-17967: Added as collaborator |  | `cf logs <environment under test> \| grep -E 'collaboratorAssigned\b'` |  |  |  |  |  |
| AR-2a | Proposed | In-app | Creator | Submits a report for approval | Approvers | An Activity Report for [Recipient name] has been submitted for approval. | Review AR | In-app · `Notifications.type=approverAssigned` (flag on) |  |  |  |  | review vs. approval? Go with Approval |
| AR-2b | Published | Email | Creator | Submits a report for approval | Approvers | Activity Report R01-AR-17967: Submitted for approval |  | `cf logs <environment under test> \| grep -E 'approverAssigned\b'` |  |  |  |  | updated existing message with "approval" |
| AR-2c | Proposed | In-app | Creator | Submits a report for approval | Collaborators | [Creator's Name] has submitted an Activity Report for approval. | View AR | In-app · `Notifications.type=approverAssigned` (flag on) |  |  |  |  |  |
| AR-2d | Proposed | Email | Creator | Submits a report for approval | Collaborators | Activity Report R01-AR-17967: Submitted for approval |  | `cf logs <environment under test> \| grep -E 'approverAssigned\b'` |  |  |  |  | Do we have this? |
| AR-3a | Proposed | In-app | Collaborator | Submits a report for approval | Approvers | An Activity Report for [Recipient's name] has been submitted for approval. | Review AR | In-app · `Notifications.type=approverAssigned` (flag on) |  |  |  |  |  |
| AR-3b | Proposed | Email | Collaborator | Submits a report for approval | Approvers | Activity Report R01-AR-17967: Submitted for approval |  | `cf logs <environment under test> \| grep -E 'approverAssigned\b'` |  |  |  |  |  |
| AR-3c | Proposed | In-app | Collaborator | Submits a report for approval | Creator | [Collaborator's name] has submitted an Activity Report for approval. | View AR | In-app · `Notifications.type=approverAssigned` (flag on) |  |  |  |  |  |
| AR-3d | Proposed | Email | Collaborator | Submits a report for approval | Creator | Activity Report R01-AR-17967: Submitted for approval |  | `cf logs <environment under test> \| grep -E 'approverAssigned\b'` |  |  |  |  |  |
| AR-4a | Proposed | In-app | Creator | Re-submit a report for approval | Approvers | A revised Activity Report for [Recipient's name] has been submitted for approval. | Review AR | In-app · `Notifications.type=activityReportResubmitted` (flag on) |  |  |  |  |  |
| AR-4b | Proposed | Email | Creator | RE-submit a report for approval | Approvers | Revised Activity Report R01-AR-17967: Submitted for approval |  | Email · planned `activityReportResubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| AR-4c | Proposed | In-app | Creator | Re-submit a report for approval | Collaborator | A revised Activity Report for [Recipient's name] has been submitted for approval. | View AR | In-app · `Notifications.type=activityReportResubmitted` (flag on) |  |  |  |  |  |
| AR-4d | Proposed | Email | Creator | Re-submit a report for approval | Collaborator | Revised Activity Report R01-AR-17967: Submitted for approval |  | Email · planned `activityReportResubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| AR-5a | Proposed | In-app | Collaborator | RE-submit a report for approval | Approvers | A revised Activity Report for [Recipient's name] has been submitted for approval. | Review AR | In-app · `Notifications.type=activityReportResubmitted` (flag on) |  |  |  |  |  |
| AR-5b | Proposed | Email | Collaborator | RE-submit a report for approval | Approvers | Revised Activity Report R01-AR-17967: Submitted for approval |  | Email · planned `activityReportResubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| AR-5c | Proposed | In-app | Collaborator | RE-submit a report for approval | Creator | [Collaborator's name] has submitted a revised Activity Report for approval. | View AR | In-app · `Notifications.type=activityReportResubmitted` (flag on) |  |  |  |  |  |
| AR-5d | Proposed | Email | Collaborator | RE-submit a report for approval | Creator | Revised Activity Report R01-AR-17967: Submitted for approval |  | Email · planned `activityReportResubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| AR-6a | Proposed | In-app | Approver 1 | Reviews report and sets status to needs action | Creator | [Approver 1 name] has requested changes to your Activity Report for [Recipient name]. | Take action/View AR | In-app · `Notifications.type=changesRequested` (flag on) |  |  |  |  |  |
| AR-6b | Published | Email | Approver 1 | Reviews report and sets status to needs action | Creator | Activity Report R01-AR-17967: Changes requested |  | `cf logs <environment under test> \| grep -E 'changesRequested\b'` |  |  |  |  | Text includes Approver name |
| AR-6c | Proposed | In-app | Approver 1 | Reviews report and sets status to needs action | Collaborator | [Approver 1 name] has requested changes to your Activity Report for [Recipient name]. | Take action | In-app · `Notifications.type=changesRequested` (flag on) |  |  |  |  |  |
| AR-6d | Proposed | Email | Approver 1 | Reviews report and sets status to needs action | Collaborator | Activity Report R01-AR-17967: Changes requested |  | `cf logs <environment under test> \| grep -E 'changesRequested\b'` |  |  |  |  |  |
| AR-6e | Proposed | In-app | Approver 1 | Reviews report and sets status to needs action | Approver 2 | [Approver 1 name] has requested changes to an Activity Report for [Recipient name]. | View AR | In-app · `Notifications.type=changesRequested` (flag on) |  |  |  |  |  |
| AR-6f | Proposed | Email | Approver 1 | Reviews report and sets status to needs action | Approver 2 | Activity Report R01-AR-17967: Changes requested by [Approver 1 name] |  | `cf logs <environment under test> \| grep -E 'changesRequested\b'` |  |  |  |  | LInk text is different for Approver 2 |
| AR-7a | Proposed | In-app | Approver 1 | Reviews report and sets status to approved | Creator | [Approver 1 name] has approved your Activity Report for [Recipient name]. | View AR | In-app · `Notifications.type=reportApproved` (flag on) |  |  |  |  |  |
| AR-7b | Published | Email | Approver 1 | Reviews report and sets status to approved | Creator | Activity Report R01-AR-17967: Approved |  | `cf logs <environment under test> \| grep -E 'reportApproved\b'` |  |  |  |  | Added approver name |
| AR-7c | Proposed | In-app | Approver 1 | Reviews report and sets status to approved | Collaborator | [Approver 1 name] has approved your Activity Report for [Recipient name]. | View AR | In-app · `Notifications.type=reportApproved` (flag on) |  |  |  |  |  |
| AR-7d | Published | Email | Approver 1 | Reviews report and sets status to approved | Collaborator | Activity Report R01-AR-17967: Approved |  | `cf logs <environment under test> \| grep -E 'reportApproved\b'` |  |  |  |  |  |
| AR-7e | Proposed | In-app | Approver 1 | Reviews report and sets status to approved | Approver 2 | [Approver 1 name] has approved your Activity Report for [Recipient name]. | View AR | In-app · `Notifications.type=reportApproved` (flag on) |  |  |  |  |  |
| AR-7f | Proposed | Email | Approver 1 | Reviews report and sets status to approved | Approver 2 | Activity Report R01-AR-17967: Approved by [Approver 1 name] |  | `cf logs <environment under test> \| grep -E 'reportApproved\b'` |  |  |  |  |  |
| AR-8a | Proposed | In-app | Approver 2 | Reviews report and sets status to needs action | Creator | [Approver 2 name] has requested changes to your Activity Report for [Recipient name]. | Take action/View AR | In-app · `Notifications.type=changesRequested` (flag on) |  |  |  |  |  |
| AR-8b | Proposed | Email | Approver 2 | Reviews report and sets status to needs action | Creator | Activity Report R01-AR-17967: Changes requested |  | `cf logs <environment under test> \| grep -E 'changesRequested\b'` |  |  |  |  | Text includes Approver name, update existing email |
| AR-8c | Proposed | In-app | Approver 2 | Reviews report and sets status to needs action | Collaborator | [Approver 2 name] has requested changes to your Activity Report for [Recipient name]. | Take action | In-app · `Notifications.type=changesRequested` (flag on) |  |  |  |  |  |
| AR-8d | Proposed | Email | Approver 2 | Reviews report and sets status to needs action | Collaborator | Activity Report R01-AR-17967: Changes requested |  | `cf logs <environment under test> \| grep -E 'changesRequested\b'` |  |  |  |  |  |
| AR-8e | Proposed | In-app | Approver 2 | Reviews report and sets status to needs action | Approver 1 | [Approver 2 name] has requested changes to an Activity Report for [Recipient name]. | View AR | In-app · `Notifications.type=changesRequested` (flag on) |  |  |  |  |  |
| AR-8f | Proposed | Email | Approver 2 | Reviews report and sets status to needs action | Approver 1 | Activity Report R01-AR-17967: Changes requested by [Approver 2 name] |  | `cf logs <environment under test> \| grep -E 'changesRequested\b'` |  |  |  |  | LInk text is different for Approver 1 |
| AR-9a | Proposed | In-app | Approver 2 | Reviews report and sets status to approved | Creator | [Approver 2 name] has approved your Activity Report for [Recipient name]. | View AR | In-app · `Notifications.type=reportApproved` (flag on) |  |  |  |  |  |
| AR-9b | Proposed | Email | Approver 2 | Reviews report and sets status to approved | Creator | Activity Report R01-AR-17967: Approved |  | `cf logs <environment under test> \| grep -E 'reportApproved\b'` |  |  |  |  |  |
| AR-9c | Proposed | In-app | Approver 2 | Reviews report and sets status to approved | Collaborator | [Approver 2 name] has approved your Activity Report for [Recipient name].. | View AR | In-app · `Notifications.type=reportApproved` (flag on) |  |  |  |  |  |
| AR-9d | Proposed | Email | Approver 2 | Reviews report and sets status to approved | Collaborator | Activity Report R01-AR-17967: Approved |  | `cf logs <environment under test> \| grep -E 'reportApproved\b'` |  |  |  |  |  |
| AR-9e | Proposed | In-app | Approver 2 | Reviews report and sets status to approved | Approver 1 | [Approver 2 name] has approved your Activity Report for [Recipient name]. | View AR | In-app · `Notifications.type=reportApproved` (flag on) |  |  |  |  |  |
| AR-9f | Proposed | Email | Approver 2 | Reviews report and sets status to approved | Approver 1 | Activity Report R01-AR-17967: Approved by [Approver 2 name] |  | `cf logs <environment under test> \| grep -E 'reportApproved\b'` |  |  |  |  |  |
