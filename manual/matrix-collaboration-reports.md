# Test Matrix — Collaboration Reports DRAFT

> Source of truth: design spreadsheet *TTA Hub Notifications.xlsx*. 
> Regenerate this page when the spec changes — see the top-level test plan for maintenance notes.

**Rows:** 50 · **Verify** column (per TTAHUB-5383 / PR #3665):

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
| CR-10a | Proposed | Email | Digest | Collaboration Reports for approval | Approvers | TTA Hub [daily/weekly/monthly] digest: Collaboration Reports for approval |  | Email digest · planned `COLLAB_REPORT_SUBMITTED_DIGEST` — not yet wired |  |  |  |  |  |
| CR-11 | Proposed | Email | Digest | Collaboration Reports needs action | Creator/Collaborator | Subject: TTA Hub [daily/weekly/monthly] digest: Collaboration Report changes requested |  | Email digest · planned `COLLAB_REPORT_NEEDS_ACTION_DIGEST` — not yet wired |  |  |  |  |  |
| CR-12 | Proposed | Email | Digest | Collaboration Reports - approved | Creator/Collaborator | Subject: TTA Hub [daily/weekly/monthly] digest: approved Collaboration Reports |  | Email digest · planned `COLLAB_REPORT_APPROVED_DIGEST` — not yet wired |  |  |  |  |  |
| CR-13 | Proposed | Email | Digest | Added as a Collaborator | Collaborator | TTA Hub [daily/weekly/monthly] digest: added as collaborator on Collaboration Reports |  | Email digest · planned `COLLAB_REPORT_COLLABORATOR_DIGEST` — not yet wired |  |  |  |  |  |
| CR-14 | Proposed | Email | Digest | Collaboration Reports need action | Creator/Collaborator | TTA Hub [daily/weekly/monthly] digest: Collaboration Report changes requested |  | Email digest · planned `COLLAB_REPORT_NEEDS_ACTION_DIGEST` — not yet wired |  |  |  |  |  |
| CR-15 | Proposed | Email | Digest | Collab Report - approved | Creator/Collaborator | TTA Hub [daily/weekly/monthly] digest: approved Collaboration Reports |  | Email digest · planned `COLLAB_REPORT_APPROVED_DIGEST` — not yet wired |  |  |  |  |  |
| CR-16 | Proposed | Email | Digest | Creator submits CR where I'm the Collab | Collaborator | TTA Hub [daily/weekly/monthly] digest: Collaboration Reports submitted for approval |  | Email digest · planned `COLLAB_REPORT_SUBMITTED_TO_COLLABORATOR_DIGEST` — not yet wired |  |  |  |  |  |
| CR-17 | Proposed | Email | Digest | Collab submits a report for approval | Creator | TTA Hub [daily/weekly/monthly] digest: Collaboration Reports submitted for approval |  | Email digest · planned `COLLAB_REPORT_COLLABORATOR_SUBMITTED_DIGEST` — not yet wired |  |  |  |  |  |
| CR-1a | Proposed | In-app | Creator | Adds a Collaborator | Collaborator | [Creator's name] added you as a Collaborator on their Collaboration Report for [Activity name]. | View AR | In-app · `Notifications.type=collabReportCollaboratorAdded` (flag on) |  |  |  |  |  |
| CR-1b | Proposed | Email | Creator | Adds a Collaborator | Collaborator | Collaboration Report R01-CR-12345: Added as collaborator |  | Email · planned `collabReportCollaboratorAdded` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-2a | Proposed | In-app | Creator | Submits a report for approval | Approvers | [Creator's name] submitted the [Activity name] Collaboration Report for approval. | Review CR | In-app · `Notifications.type=collabReportSubmitted` (flag on) |  |  |  |  |  |
| CR-2b | Proposed | Email | Creator | Submits a report for approval | Approvers | Collaboration Report R01-CR-12345: Submitted for approval |  | Email · planned `collabReportSubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-2c | Proposed | In-app | Creator | Submits a report for approval | Collaborator | [Creator's name] submitted the [Activity name] Collaboration Report for approval. | View CR | In-app · `Notifications.type=collabReportSubmitted` (flag on) |  |  |  |  |  |
| CR-2d | Proposed | Email | Creator | Submits a report for approval | Collaborator | Collaboration Report R01-CR-12345: Submitted for approval |  | Email · planned `collabReportSubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-3a | Proposed | In-app | Collaborator | Submits a report for approval | Approvers | [Collaborator's name] submitted the [Activity name] Collaboration Report for approval. | Review CR | In-app · `Notifications.type=collabReportSubmitted` (flag on) |  |  |  |  |  |
| CR-3b | Proposed | Email | Collaborator | Submits a report for approval | Approvers | Collaborator Report R01-CR-12345: Submitted for approval |  | Email · planned `collabReportSubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-3c | Proposed | In-app | Collaborator | Submits a report for approval | Creator | [Collaborator's name] submitted the [Activity name] Collaboration Report for approval. | View CR | In-app · `Notifications.type=collabReportSubmitted` (flag on) |  |  |  |  |  |
| CR-3d | Proposed | Email | Collaborator | Submits a report for approval | Creator | Collaborator Report R01-CR-12345: Submitted for approval |  | Email · planned `collabReportSubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-4a | Proposed | In-app | Creator | Re-submit a report for approval | Approvers | [Creator's name] submitted the revised [Activity name] Collaboration Report for approval. | Review CR | In-app · `Notifications.type=collabReportResubmitted` (flag on) |  |  |  |  | Add Title |
| CR-4b | Proposed | Email | Creator | Re-submit a report for approval | Approvers | Revised Collaboration Report R01-CR-12345: Submitted for approval |  | Email · planned `collabReportResubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-4c | Proposed | In-app | Creator | Re-submit a report for approval | Collaborators | [Creator's name] submitted the revised [Activity name] Collaboration Report for approval. | View CR | In-app · `Notifications.type=collabReportResubmitted` (flag on) |  |  |  |  |  |
| CR-4d | Proposed | Email | Creator | Re-submit a report for approval | Collaborators | Revised Collaboration Report R01-CR-12345: Submitted for approval |  | Email · planned `collabReportResubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-5a | Proposed | In-app | Collaborator | Re-submit a report for approval | Approvers | [Collaborator's name] submitted the revised [Activity name] Collaboration Report for approval. | Review CR | In-app · `Notifications.type=collabReportResubmitted` (flag on) |  |  |  |  |  |
| CR-5b | Proposed | Email | Collaborator | Re-submit a report for approval | Approvers | Revised Collaboration Report R01-CR-12345: Submitted for approval |  | Email · planned `collabReportResubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-5c | Proposed | In-app | Collaborator | Re-submit a report for approval | Creator | [Collaborator's name] has submitted a revised Collaboration Report for [Activity name]. | View CR | In-app · `Notifications.type=collabReportResubmitted` (flag on) |  |  |  |  |  |
| CR-5d | Proposed | Email | Collaborator | Re-submit a report for approval | Creator | Revised Collaboration Report R01-CR-12345: Submitted for approval |  | Email · planned `collabReportResubmitted` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-6a | Proposed | In-app | Approver 1 | Reviews report and sets status to needs action | Creator | [Approver 1 name] has requested changes to your Collaboration Report for [Activity name]. | Take action/View AR | In-app · `Notifications.type=collabReportNeedsAction` (flag on) |  |  |  |  |  |
| CR-6b | Proposed | Email | Approver 1 | Reviews report and sets status to needs action | Creator | Collaboration Report R01-CR-12345: Changes requested |  | Email · planned `collabReportNeedsAction` — not yet in EMAIL_ACTIONS |  |  |  |  | Text includes Approver name |
| CR-6c | Proposed | In-app | Approver 1 | Reviews report and sets status to needs action | Collaborator | [Approver 1 name] has requested changes to your Collaboration Report for [Activity name]. | Take action | In-app · `Notifications.type=collabReportNeedsAction` (flag on) |  |  |  |  |  |
| CR-6d | Proposed | Email | Approver 1 | Reviews report and sets status to needs action | Collaborator | Collaboration Report R01-CR-12345: Changes requested |  | Email · planned `collabReportNeedsAction` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-6e | Proposed | In-app | Approver 1 | Reviews report and sets status to needs action | Approver 2 | [Approver 1 name] has requested changes to your Collaboration Report for [Activity name]. | View AR | In-app · `Notifications.type=collabReportNeedsAction` (flag on) |  |  |  |  |  |
| CR-6f | Proposed | Email | Approver 1 | Reviews report and sets status to needs action | Approver 2 | Collaboration Report R01-CR-12345: Changes requested by [Approver 1 name] |  | Email · planned `collabReportNeedsAction` — not yet in EMAIL_ACTIONS |  |  |  |  | LInk text is different for Approver 2 |
| CR-7a | Proposed | In-app | Approver 1 | Reviews report and sets status to approved | Creator | [Approver 1 name] has approved your Collaboration Report for [Activity name]. | View AR | In-app · `Notifications.type=collabReportApproved` (flag on) |  |  |  |  |  |
| CR-7b | Proposed | Email | Approver 1 | Reviews report and sets status to approved | Creator | Collaboration Report R01-CR-12345: Approved |  | Email · planned `collabReportApproved` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-7c | Proposed | In-app | Approver 1 | Reviews report and sets status to approved | Collaborator | [Approver 1 name] has approved your Collaboration Report for [Activity name]. | View AR | In-app · `Notifications.type=collabReportApproved` (flag on) |  |  |  |  |  |
| CR-7d | Proposed | Email | Approver 1 | Reviews report and sets status to approved | Collaborator | Collaboration Report R01-CR-12345: Approved |  | Email · planned `collabReportApproved` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-7e | Proposed | In-app | Approver 1 | Reviews report and sets status to approved | Approver 2 | [Approver 1 name] has approved a Collaboration Report for [Activity name]. | View AR | In-app · `Notifications.type=collabReportApproved` (flag on) |  |  |  |  |  |
| CR-7f | Proposed | Email | Approver 1 | Reviews report and sets status to approved | Approver 2 | Collaboration Report R01-CR-12345: Approved by [Approver 1 name] |  | Email · planned `collabReportApproved` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-8a | Proposed | In-app | Approver 2 | Reviews report and sets status to needs action | Creator | [Approver 2 name] has requested changes to your Collaboration Report for [Activity name]. | Take action/View AR | In-app · `Notifications.type=collabReportNeedsAction` (flag on) |  |  |  |  |  |
| CR-8b | Proposed | Email | Approver 2 | Reviews report and sets status to needs action | Creator | Collaboration Report R01-CR-12345: Changes requested |  | Email · planned `collabReportNeedsAction` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-8c | Proposed | In-app | Approver 2 | Reviews report and sets status to needs action | Collaborator | [Approver 2 name] has requested changes to your Collaboration Report for [Activity name]. | Take action | In-app · `Notifications.type=collabReportNeedsAction` (flag on) |  |  |  |  |  |
| CR-8d | Proposed | Email | Approver 2 | Reviews report and sets status to needs action | Collaborator | Collaboration Report R01-CR-12345: Changes requested |  | Email · planned `collabReportNeedsAction` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-8e | Proposed | In-app | Approver 2 | Reviews report and sets status to needs action | Approver 1 | [Approver 2 name] has requested changes to Collaboration Report for [Activity name]. | View AR | In-app · `Notifications.type=collabReportNeedsAction` (flag on) |  |  |  |  |  |
| CR-8f | Proposed | Email | Approver 2 | Reviews report and sets status to needs action | Approver 1 | Collaboration Report R01-CR-12345: Changes requested by [Approver 2 name] |  | Email · planned `collabReportNeedsAction` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-9a | Proposed | In-app | Approver 2 | Reviews report and sets status to approved | Creator | [Approver 2 name] has approved your Collaboration Report for [Activity name]. | View AR | In-app · `Notifications.type=collabReportApproved` (flag on) |  |  |  |  |  |
| CR-9b | Proposed | Email | Approver 2 | Reviews report and sets status to approved | Creator | Collaboration Report R01-CR-12345:  Approved |  | Email · planned `collabReportApproved` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-9c | Proposed | In-app | Approver 2 | Reviews report and sets status to approved | Collaborator | [Approver 2 name] has approved your Collaboration Report for [Activity name]. | View AR | In-app · `Notifications.type=collabReportApproved` (flag on) |  |  |  |  |  |
| CR-9d | Proposed | Email | Approver 2 | Reviews report and sets status to approved | Collaborator | Collaboration Report R01-CR-12345:  Approved |  | Email · planned `collabReportApproved` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
| CR-9e | Proposed | In-app | Approver 2 | Reviews report and sets status to approved | Approver 1 | [Approver 2 name] has approved a Collaboration Report for [Activity name]. | View AR | In-app · `Notifications.type=collabReportApproved` (flag on) |  |  |  |  |  |
| CR-9f | Proposed | Email | Approver 2 | Reviews report and sets status to approved | Approver 1 | Collaboration Report R01-CR-12345: Approved by [Approver 2 name] |  | Email · planned `collabReportApproved` — not yet in EMAIL_ACTIONS |  |  |  |  |  |
