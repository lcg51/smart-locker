# Relock scheduler

Last updated: 2026-11-25.
Status: runbook ready. The provider setup and the closed-tab measurement are
operator steps; record them in the table below before inviting residents.

## Why this exists

Guest unlocks set a server-side deadline in `Locker.relockAt`. While the guest
page stays open, it calls the relock action at the deadline. If the guest closes
the tab, nothing on the client can relock the locker, so `GET /api/cron/relock`
sweeps due lockers (up to 50 per call) whose deadline has passed.

Vercel Hobby runs crons at most once per day. `vercel.json` therefore schedules
only the daily `/api/cron/cleanup`, and an external scheduler must call
`/api/cron/relock` every minute.

## Route contract

```http
GET /api/cron/relock
Authorization: Bearer <CRON_SECRET>
```

| Condition | Status | Body |
|---|---|---|
| `CRON_SECRET` is not configured | `503` | `{"error":"cron_not_configured"}` |
| Missing or wrong bearer token | `401` | `{"error":"unauthorized"}` |
| Valid token | `200` | `{"relocked":<n>,"failed":<m>}` |

The sweep is idempotent: it selects only lockers with `relockAt <= now`, so a
retry or an overlapping schedule is safe. The route never exposes the secret or
lock identifiers in its response.

The route contract is covered by `tests/api/cron-relock.test.ts`:

```bash
pnpm test tests/api/cron-relock.test.ts
```

## Prerequisites

- The public deployment URL, including `https://` (not `localhost`).
- `CRON_SECRET` set in the Vercel Production environment, at least 16 random
  characters. The fallback returns `503` until it is set.
- A scheduler account. The recommended provider is **Upstash QStash**; the
  zero-cost alternative is **cron-job.org**.

## Recommended: Upstash QStash

QStash supports one-minute schedules, forwards custom headers, retries failed
deliveries, and keeps run logs. The project already uses Upstash for rate
limiting.

### Cost note

QStash's free tier allows 1,000 messages per day. A one-minute schedule is
1,440 messages per day, so the schedule needs the pay-as-you-go plan. At
$1 per 100,000 messages, the schedule costs roughly **$0.13–$0.43/month**
depending on whether the free daily allowance still applies on pay-as-you-go.
Confirm the current pricing before enabling it; adding a payment method can
also move the account's other free resources, including the optional Redis rate
limiter, to paid plans. If the pilot must stay entirely free, use cron-job.org
instead.

### Create the schedule with the API

Get the QStash token from the Upstash console (QStash → API Keys) and the
`CRON_SECRET` from the deployment's environment. Read both without echoing them
so they do not land in shell history.

```bash
# Paste each value at the prompt; the input is hidden.
read -rs QSTASH_TOKEN; export QSTASH_TOKEN
read -rs CRON_SECRET; export CRON_SECRET

# Copy QSTASH_URL from the QStash console. EU default:
export QSTASH_URL='https://qstash.upstash.io'
export APP_URL='https://your-deployment.example'

curl -X POST \
  -H "Authorization: Bearer $QSTASH_TOKEN" \
  -H "Upstash-Cron: * * * * *" \
  -H "Upstash-Method: GET" \
  -H "Upstash-Schedule-Id: relock-fallback" \
  -H "Upstash-Redact-Fields: header[Authorization]" \
  -H "Upstash-Forward-Authorization: Bearer $CRON_SECRET" \
  "$QSTASH_URL/v2/schedules/$APP_URL/api/cron/relock"
```

- `QSTASH_URL` is region-specific. Copy it from the console. EU is
  `https://qstash.upstash.io` (also `https://qstash-eu-central-1.upstash.io`);
  US is `https://qstash-us-east-1.upstash.io`. A token from one region does not
  work in another.
- `Upstash-Method: GET` is required; QStash defaults to `POST`.
- `Upstash-Schedule-Id` makes a re-run update the same schedule instead of
  creating duplicates. Use a stable id such as `relock-fallback`.
- `Upstash-Redact-Fields: header[Authorization]` hides the bearer value in
  QStash logs and API responses. Redaction only affects QStash storage; the
  header is still delivered to the destination.
- `Upstash-Forward-Authorization` is delivered to the destination as
  `Authorization: Bearer ...`.
- Keep the secret in the header, never in the URL or a query string.
- Expected response: `{"scheduleId":"relock-fallback"}`.
- A new schedule can take up to 60 seconds to activate.

### Create the schedule in the console

The console is convenient, but verify that the forwarded `Authorization` header
is redacted before saving. If the console does not expose redaction, use the API
call above.

1. Open Upstash → QStash → **Schedules** → **Create**.
2. Destination: `https://<host>/api/cron/relock`.
3. Cron: `* * * * *` (every minute).
4. Method: `GET`.
5. Add a forwarded header `Authorization: Bearer <CRON_SECRET>`.
6. Enable redaction for the `Authorization` header, if available.
7. Create the schedule, wait up to 60 seconds for activation, and open its logs.
8. Confirm a `200` with a JSON body. If there is no run yet, publish a one-off
   message to the same destination from QStash.
9. Never screenshot or share the unredacted header.

## Alternative: cron-job.org

1. Create a cron job with the destination
   `https://<host>/api/cron/relock`.
2. Schedule it every minute.
3. Set the method to `GET`.
4. Enable a custom header `Authorization: Bearer <CRON_SECRET>`.
5. Save, run it once, and confirm `200` in the execution history.
6. Check the provider's fair-use limits before relying on a free plan.
7. Note that cron-job.org disables a job after 25 consecutive failures. After
   fixing a secret or URL error, re-enable the job manually.

Do not use a GitHub Actions schedule: its minimum interval is five minutes and
its start times are unreliable.

## Verify from your machine

The contract tests are the local check. Against the deployment:

```bash
# Missing bearer: 401
curl -i "$APP_URL/api/cron/relock"

# Valid bearer: 200 and a JSON body
curl -i -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/relock"
```

The `503` path only occurs when `CRON_SECRET` is unset, so it is covered by the
contract test rather than by a deployment that already has the secret. A
`401`/`403` from Vercel before the route runs usually means Deployment
Protection or a WAF rule is challenging the scheduler; allow the provider's IPs
or exempt this path.

Then confirm the scheduler's run history shows a successful call within the
last two minutes. A new QStash schedule can take up to 60 seconds to activate.

## Closed-tab acceptance

1. Create a share link with at least two unlocks.
2. Open it in a private browser window and unlock the locker.
3. Close the tab before the 30-second countdown ends.
4. Wait at most two scheduler intervals (two minutes).
5. Reload the resident dashboard and confirm the locker shows **Locked**.
6. Confirm the activity log records the relock. Use the guest unlock timestamp
   and the relock event timestamp for the measured latency rather than
   estimating from the schedule.
7. Record the measured latency below.

The locker must relock within two intervals (normally within one). A later
relock is a failure for the pilot even if the request eventually succeeds.

## Deployment record

Fill this in after the schedule is live. Do not mark Task 38 complete until it is
filled and the closed-tab acceptance passes.

| Field | Value |
|---|---|
| Provider | QStash / cron-job.org |
| Region | EU / US / n/a |
| Schedule ID | `relock-fallback` or provider id |
| Schedule | every 1 minute |
| Target | `https://<host>/api/cron/relock` |
| Auth header | `Authorization: Bearer <redacted>` |
| Configured on | YYYY-MM-DD |
| Achieved interval | <measured> |
| Closed-tab relock latency | <measured> |
| Verified by | <operator> |
| Run-log evidence | <link or note; no unredacted headers> |

## Monitoring and failure modes

- **401** — the forwarded header is missing, was stripped, or the secret differs
  from the deployment's `CRON_SECRET`. Re-copy both values.
- **503** — `CRON_SECRET` is not set in the deployment. Set it and redeploy.
- **Timeout or `500`** — the route is waiting on the lock provider or hit an
  unexpected server/database error. Inspect the `failed` count, the function
  logs, and the activity log. A provider failure restores the deadline, so the
  next one-minute sweep tries again; QStash retries HTTP failures and timeouts,
  not a `200` response that reports `failed` counts.
- **No runs** — the schedule is paused/deleted, the provider account is over its
  limit, the destination URL changed, or the schedule has not activated yet
  (allow up to 60 seconds). Check the provider first.
- **Duplicate runs** — harmless for relock, but investigate overlapping
  schedules so the logs stay useful.

Review the provider's run history at least once during the pilot week, and after
any secret rotation or deployment URL change.

## Secret rotation

1. Generate a new `CRON_SECRET`.
2. Update it in Vercel Production and redeploy.
3. Re-run the same schedule-create call with the same `Upstash-Schedule-Id` and
   the new forwarded header, or update the header in the provider console.
4. Run the contract checks and wait for the next scheduled call.
5. Confirm it returns `200` and that the provider log shows the header redacted.

## Rollback

Pause or delete the schedule to stop the fallback. Guests who keep the tab open
still relock at the deadline; closed tabs will not. Do not disable
`LOCK_COMMANDS_ENABLED` to pause relocking: that also blocks owner and guest
unlocks.

When the project moves to Vercel Pro, add `/api/cron/relock` back to
`vercel.json` with a one-minute schedule and remove the external schedule.

## Security notes

- Use HTTPS for the destination; the bearer token is sent on every call.
- Keep `CRON_SECRET` in Vercel and the scheduler's secret store only.
- Enable `Upstash-Redact-Fields: header[Authorization]` so QStash logs and the
  dashboard do not show the bearer. Redaction is not automatic.
- Never put the secret in the URL, a screenshot, a ticket, the repository, or
  shell history. Clear the history entry if a value was pasted directly.
- The response contains only counts, never lock identifiers or guest data.
