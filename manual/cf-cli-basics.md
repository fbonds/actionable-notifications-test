# Cloud Foundry CLI Basics — Personal Cheat Sheet DRAFT

> **Project context (added for this repo):** This is the reference for the
> Cloud Foundry / `cf` log-inspection layer of the Actionable Notifications
> test plan. In lower environments emails are not actually sent — the dispatch
> decision is logged — so `cf logs` is the **source of truth for ~150 of the
> 174 notification specs**. See [`test-plan.md`](./test-plan.md) for the
> per-test execution flow and `../SESSION_STATE.md` for current findings.
>
> **For notification testing specifically:**
> - Notification emails fire from the **`worker`** process, not `web` — tail
>   that one: log lines tagged `[APP/PROC/WORKER/0]`.
> - Grep by the **action key** in the log `message` (e.g. `changesRequested`,
>   `collaboratorAssigned`, `approverAssigned`, `reportApproved`, and the
>   `trainingReport*` / `*Digest` variants), and/or by the report
>   **`displayId`**. One action key can map to several matrix rows;
>   **recipient/subject/channel are not logged**, so confirm those via the
>   per-release spot-check.
> - Environments (app names) — pick the one matching the build under test;
>   the commands are identical for all:
>   - `tta-smarthub-staging` (staging; this cheat sheet's examples)
>   - `tta-smarthub-dev-blue`
>   - `tta-smarthub-dev-gold`
>   - `tta-smarthub-dev-green` (notification captures to date used this one)
>   - `tta-smarthub-dev-pink`
>   - `tta-smarthub-dev-red`
>
>   The five color-named `dev-*` apps are per-developer environments (each
>   dev is assigned one).
> - When to use which (this feature):
>   - **Inter-sprint check-ins** → the assigned dev's color. The dev leading
>     THIS release is on **`tta-smarthub-dev-blue`** — tail that one for the
>     redesign's notification events.
>   - **End-to-end testing** → local Docker (see the time-driven section of
>     `test-plan.md`).
>   - **Release candidates** (polishing / final bug-hunt) → one of the dev
>     colors **or** `tta-smarthub-staging`.
> - Prefer the read-only commands (Steps 2–8). Avoid the write commands on
>   shared spaces.

---

Environment: macOS, cf CLI v8.18.3 (v8 syntax throughout)

## Core mental model
API endpoint → org → space → apps.
You log in to an API endpoint, target an org + space, and most commands act on the currently targeted space.

## Step 1 — Check CLI version
```
cf version
```
Confirms which CLI generation you have (v6 vs v7/v8 have some different command names). You have v8.

## Step 2 — Check current target / login status
```
cf target
```
Shows the API endpoint you're pointed at, who you're logged in as, and which org/space is targeted. If you're not logged in, it tells you so.

## Step 3 — List apps in the targeted space
```
cf apps
```
Read-only. Shows each app's name, state (started/stopped), instance count, and memory/disk. App names from this list are used in most other commands.

Note: your environment is cloud.gov (US government CF platform). Currently targeting org `hhs-acf-ohs-tta`, space `ttahub-staging` — a shared staging space, so prefer read-only commands while learning.

## Step 4 — Inspect a single app
```
cf app <app-name>
```
e.g. `cf app tta-smarthub-staging`
Read-only. Detailed view of one app: last upload time, buildpacks, routes, and live per-instance stats (CPU/memory/disk) for each process type. First stop for "is the app healthy?"

Reading `cf apps` output: `web:1/1, worker:1/1` = process types with running/requested instance counts. `0/1` + stopped = app is intentionally down.

## Step 5 — Logs
```
cf logs <app-name> --recent    # dump recent buffer, then exit
cf logs <app-name>             # stream live logs (Ctrl+C to stop)
```
Read-only. Log line sources: `APP/PROC/WEB` = your app's output, `RTR` = router HTTP access logs, `CELL`/`STG` = platform events (restarts, staging).

Reading `cf app` output: watch memory vs limit per process — if an instance hits its memory limit, CF kills and restarts it. (e.g. worker at 354M/512M = ~69%, worth monitoring.)

## Reading cf logs — lessons learned
- `ERR` = written to stderr, not necessarily an error (e.g. deprecation warnings + stack traces).
- 304 = browser cache hit, normal. 499 = client closed connection early. 101 = WebSocket upgrade (its response_time = socket lifetime, not slowness).
- Find real slow requests via `response_time:` on RTR lines; cross-check response size (large body + slow = pagination/caching candidate).
- Random 401s on endpoints your app doesn't have = internet scanners probing; expected on public URLs.
- Logs may contain session cookies/tokens in request dumps — treat log exports as sensitive.

Useful triage one-liners on a saved log file:
```
grep -o 'HTTP/1.1" [0-9]\{3\}' logs.txt | awk '{print $2}' | sort | uniq -c   # status code histogram
grep -o 'response_time:[0-9.]*' logs.txt | sort -t: -k2 -rn | head            # slowest requests
grep '"level":"warn"' logs.txt                                                # app warnings
```

## Step 6 — List services in the space
```
cf services
```
Read-only. Shows backing services (databases, Redis, S3, etc.) and which apps are bound to each. Binding a service injects its credentials into the app's environment at startup (via VCAP_SERVICES).
cloud.gov note: `cloud-gov-service-account` entries are machine credentials (e.g. CI/CD deployer accounts), not app backing services.

## Step 7 — App environment & configuration
```
cf env <app-name>
```
Read-only, but output contains LIVE SECRETS — never paste, commit, screenshot, or share it (including into chat tools). If credentials do leak: notify the team, rotate. VCAP_SERVICES creds rotate by unbinding/rebinding the service; user-provided creds rotate at their source systems.

Four layers in the output:
1. VCAP_SERVICES — platform-injected JSON with credentials for each bound service (this is what "binding" does).
2. VCAP_APPLICATION — app metadata (name, URIs, org/space IDs).
3. User-Provided — team-set vars via `cf set-env` or pipeline: build info (BUILD_COMMIT traces running code to git), feature flags, external integration creds.
4. Environment Variable Groups — platform-wide vars set by operators for all apps.

## Step 8 — Audit trail of app lifecycle events
```
cf events <app-name>
```
Read-only. Timestamped record of pushes, restarts, restages, scaling, and crashes — including the actor (human or deployer service account). `app.crash` events include exit descriptions; first stop after an unexpected restart.

Anatomy of one deploy in `cf events` (read oldest→newest): apply_manifest → app/process update + scale → package.create/upload (source uploaded) → build.create (buildpack staging starts) → build.staged → droplet.create (runnable artifact) → droplet.mapped → revision.create → restart → process.ready per process (health checks passed). `[PRIVATE DATA HIDDEN]` = CF redacting start commands. Lone task.create events = one-off tasks via `cf run-task` (e.g. cron jobs). Note: even `cf env` reads are audited (audit.app.environment.show).

## Write commands — reference only (NOT run during this tutorial)
These change real state. On a shared space like ttahub-staging, coordinate with the team first; on this project deploys go through CI, so manual use of these should be rare.

```
cf push <app>                      # deploy: uploads code, stages with buildpack, restarts.
                                   # Reads manifest.yml in the current directory. THE deploy command.
cf restart <app>                   # stop + start with the EXISTING droplet (no rebuild).
                                   # Use after set-env, or to clear a wedged process.
cf restage <app>                   # re-runs the buildpack against the existing source.
                                   # Use when buildpack/stack/service bindings changed but code didn't.
cf restart-app-instance <app> <i>  # bounce a single instance (e.g. one stuck instance of several).
cf scale <app> -i 3                # horizontal scale: 3 instances. Safe-ish, takes effect live.
cf scale <app> -m 1G -k 2G         # vertical scale: memory/disk. CAUSES A RESTART.
cf scale <app> --process worker -i 2   # scale a specific process type.
cf set-env <app> KEY value         # set a user-provided env var. NOT live until restart/restage.
cf unset-env <app> KEY             # remove one. Same caveat.
cf run-task <app> "node script.js" # one-off task in a fresh container (migrations, cron-style jobs).
cf stop <app> / cf start <app>     # take an app down / bring it up. Stopped apps free their
                                   # memory quota but keep their routes and configuration.
cf ssh <app>                       # shell into a running container. Read-mostly debugging;
                                   # changes inside a container are EPHEMERAL (lost on restart).
cf delete <app>                    # DANGER: removes the app. -r also deletes its routes.
cf delete-service <name>           # EXTREME DANGER: can destroy the database. Never casually.
```

Mental model: `push` = new code, `restage` = same code rebuilt, `restart` = same build rerun. Env var changes require one of those to take effect. Containers are ephemeral — anything not in the droplet, a bound service, or S3 disappears on restart.

## Handy everyday extras
```
cf orgs / cf spaces                # list what you can target
cf target -s <space>               # switch space (e.g. between staging and prod spaces)
cf login --sso -a api.fr.cloud.gov # cloud.gov login (browser-based SSO, gives a passcode)
cf <command> --help                # every command documents itself
```
