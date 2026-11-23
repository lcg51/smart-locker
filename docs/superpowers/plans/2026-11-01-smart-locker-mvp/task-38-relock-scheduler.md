# Task 38: Relock scheduler runbook and verification

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. This is an operations task: it has no production-code steps and no TDD loop, but it must carry checkable commands and recorded acceptance evidence.

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Pilot hardening and growth design](../../specs/2026-11-03-smart-locker-pilot-hardening-design.md) §22.
> Phase 1.5 (pilot-critical ops). **Depends on:** Task 16, Task 21.

---

**Files:**
- Create: `docs/relock-scheduler.md`
- Modify: `README.md` (staging cron section)
- Modify: `docs/pilot-setup-guide.md` (deploy and guest acceptance)
- Modify: `.superpowers/sdd/2026-11-01-smart-locker-mvp/progress.md` (record the chosen provider and achieved interval)

**Interfaces:**
- Consumes: `GET /api/cron/relock`, `CRON_SECRET`, `Locker.relockAt`, `relockDueLockers()`.
- Produces: an external scheduler that calls the route once per minute, with a
  documented provider, secret storage, verification commands, and measured
  closed-tab relock latency.

**Non-goals:** No app code changes unless verification exposes a bug; no Vercel
Pro plan; no new delayed-job service; no resident-facing surface.

**Current behavior:** `vercel.json` intentionally schedules only the daily
cleanup cron because Vercel Hobby rejects sub-daily crons. The relock route
returns `503 cron_not_configured` without a secret, `401 unauthorized` without
the bearer token, and `{ relocked, failed }` with it.

- [ ] **Step 1: Confirm the route contract**

Run against staging with the secret exported only in the shell:

```bash
curl -i "$APP_URL/api/cron/relock"
curl -i -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/relock"
```

Expected: `503`/`401` without valid auth, and `200` with a JSON body such as
`{"relocked":0,"failed":0}`.

- [ ] **Step 2: Choose and record the scheduler**

Recommendation: **Upstash QStash** (already an optional dependency for rate
limiting, supports one-minute schedules and custom headers). Acceptable
alternative: **cron-job.org** with a custom `Authorization` header. Reject
GitHub Actions schedules: their minimum interval is five minutes and their
timing is unreliable.

Record the choice and the reason in `docs/relock-scheduler.md`:

```md
# Relock scheduler

Provider: <QStash | cron-job.org>
Schedule: every 1 minute
Target: GET https://<host>/api/cron/relock
Auth: Authorization: Bearer <CRON_SECRET>
Owner: <operator>
Configured on: YYYY-MM-DD
Achieved interval: <measured>
```

- [ ] **Step 3: Configure the schedule**

For QStash:

1. Create a schedule with destination `https://<host>/api/cron/relock`.
2. Add the header `Authorization: Bearer <CRON_SECRET>`.
3. Use a one-minute cron expression and the `Europe/Madrid` timezone.
4. Store the secret in the scheduler's secret store, never in the URL.

Document the equivalent steps for the chosen alternative. Keep the secret out of
the repository, screenshots, and logs.

- [ ] **Step 4: Verify the scheduler from the provider side**

Trigger one manual run from the provider dashboard. Expected: `200` and a JSON
body. Then confirm the provider's run history shows a successful call within the
last two minutes.

If the provider reports failures, check in this order:

1. `401` — the bearer header is missing or the secret differs.
2. `503` — `CRON_SECRET` is not set on the deployment.
3. Timeout — the route is waiting on the lock provider; inspect `failed` counts.

- [ ] **Step 5: Run the closed-tab acceptance**

1. Create a share link with at least two unlocks.
2. Open it in a private browser window and unlock the locker.
3. Close the tab before the 30-second countdown ends.
4. Wait two scheduler intervals (at most two minutes).
5. Confirm the locker shows **Locked** in the resident dashboard and the
   activity log records the relock.
6. Record the measured latency in `docs/relock-scheduler.md` and the SDD ledger.

Expected: the locker relocks within two intervals; no resident action is needed.

- [ ] **Step 6: Update the operator docs**

In `README.md` and `docs/pilot-setup-guide.md`, replace the generic "call it from
an external scheduler" note with the chosen provider steps, the one-minute
interval, the secret-header requirement, and the measured latency. State that
the Vercel Hobby daily cron still runs `/api/cron/cleanup` only.

- [ ] **Step 7: Verification**

Run:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "$APP_URL/api/cron/relock"
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/relock"
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: `401`, `200`, and a green local gate. The E2E suite is unchanged
because this task adds no app behavior.

- [ ] **Step 8: Commit**

```bash
git add README.md docs/relock-scheduler.md docs/pilot-setup-guide.md
git commit -m "docs: run the relock fallback every minute"
```

---

## Completion evidence

The task is complete only when `docs/relock-scheduler.md` records the provider,
the schedule, the achieved interval, and the closed-tab measurement, and the
operator confirms the scheduler is enabled in the pilot environment.
