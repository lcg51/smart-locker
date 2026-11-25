# Relock scheduler

Last updated: 2026-11-25.
Status: runbook ready. The provider setup and the closed-tab measurement are
operator steps; record them in the table below before inviting residents.

## Why this exists

Guest unlocks set a server-side deadline in `Locker.relockAt`. While the guest
page stays open, it calls the relock action at the deadline. If the guest closes
the tab, nothing on the client can relock the locker, so `GET /api/cron/relock`
sweeps every locker whose deadline has passed.

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
1,440 messages per day, so the schedule needs the pay-as-you-go tier. At pilot
scale the excess is roughly 13,000 messages per month, about **$0.13/month** at
$1 per 100,000 messages. Confirm the current pricing before enabling it. If the
pilot must stay entirely free, use cron-job.org instead.

### Create the schedule with the API

Get the QStash token from the Upstash console (QStash → API Keys) and the
`CRON_SECRET` from the deployment's environment. Keep both out of the shell
history where possible.

```bash
export QSTASH_TOKEN='...'
export QSTASH_URL='https://qstash.upstash.io'
export CRON_SECRET='...'
export APP_URL='https://your-deployment.example'

curl -X POST \
  -H "Authorization: Bearer $QSTASH_TOKEN" \
  -H "Upstash-Cron: * * * * *" \
  -H "Upstash-Method: GET" \
  -H "Upstash-Forward-Authorization: Bearer $CRON_SECRET" \
  "$QSTASH_URL/v2/schedules/$APP_URL/api/cron/relock"
```

- `QSTASH_URL` is `https://qstash.upstash.io` for the default region.
- `Upstash-Method: GET` is required; QStash defaults to `POST`.
- `Upstash-Forward-Authorization` is delivered to the destination as
  `Authorization: Bearer ...`.
- Keep the secret in the header, never in the URL or a query string.
- Expected response: `{"scheduleId":"..."}`.

### Create the schedule in the console

1. Open Upstash → QStash → **Schedules** → **Create**.
2. Destination: `https://<host>/api/cron/relock`.
3. Cron: `* * * * *` (every minute).
4. Method: `GET`.
5. Add a forwarded header `Authorization: Bearer <CRON_SECRET>`.
6. Create the schedule and open its logs.
7. Use **Run now** once and confirm a `200` with a JSON body.

## Alternative: cron-job.org

1. Create a cron job with the destination
   `https://<host>/api/cron/relock`.
2. Schedule it every minute.
3. Enable a custom header `Authorization: Bearer <CRON_SECRET>`.
4. Save, run it once, and confirm `200` in the execution history.
5. Check the provider's fair-use limits before relying on a free plan.

Do not use a GitHub Actions schedule: its minimum interval is five minutes and
its start times are unreliable.

## Verify from your machine

The contract tests are the local check. Against the deployment:

```bash
# No secret configured: 503
curl -i "$APP_URL/api/cron/relock"

# Missing or wrong bearer: 401
curl -i "$APP_URL/api/cron/relock"

# Valid bearer: 200 and a JSON body
curl -i -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/relock"
```

Then confirm the scheduler's run history shows a successful call within the
last two minutes.

## Closed-tab acceptance

1. Create a share link with at least two unlocks.
2. Open it in a private browser window and unlock the locker.
3. Close the tab before the 30-second countdown ends.
4. Wait at most two scheduler intervals (two minutes).
5. Confirm the resident dashboard shows the locker **Locked**.
6. Confirm the activity log records the relock.
7. Record the measured latency below.

The locker must relock within two intervals. A later relock is a failure for the
pilot even if the request eventually succeeds.

## Deployment record

Fill this in after the schedule is live. Do not mark Task 38 complete until it is
filled and the closed-tab acceptance passes.

| Field | Value |
|---|---|
| Provider | QStash / cron-job.org |
| Schedule | every 1 minute |
| Target | `https://<host>/api/cron/relock` |
| Configured on | YYYY-MM-DD |
| Achieved interval | <measured> |
| Closed-tab relock latency | <measured> |
| Verified by | <operator> |
| Run-log evidence | <link or note> |

## Monitoring and failure modes

- **401** — the forwarded header is missing, was stripped, or the secret differs
  from the deployment's `CRON_SECRET`. Re-copy both values.
- **503** — `CRON_SECRET` is not set in the deployment. Set it and redeploy.
- **Timeout** — the route is waiting on the lock provider. Inspect the `failed`
  count and the activity log; a transient provider failure is retried by the
  scheduler, and the sweep is idempotent.
- **No runs** — the schedule is paused/deleted, the provider account is over its
  limit, or the destination URL changed. Check the provider first.
- **Duplicate runs** — harmless for relock, but investigate overlapping
  schedules so the logs stay useful.

Review the provider's run history at least once during the pilot week, and after
any secret rotation or deployment URL change.

## Secret rotation

1. Generate a new `CRON_SECRET`.
2. Update it in Vercel Production and redeploy.
3. Update the scheduler's forwarded header.
4. Run the contract checks and a manual **Run now**.
5. Confirm the next scheduled call returns `200`.

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
- Never put the secret in the URL, a screenshot, a ticket, or the repository.
- The response contains only counts, never lock identifiers or guest data.
