# Task 16: Guest unlock auto-relock

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Pilot hardening and growth design](../../specs/2026-11-03-smart-locker-pilot-hardening-design.md).
> Phase 1.5. **Depends on:** Task 03, Task 07, Task 08, Task 12.

---

**Files:**
- Modify: `prisma/schema.prisma` (`Locker.relockAt`)
- Create migration: `prisma/migrations/<timestamp>_locker_relock_at/migration.sql` via `prisma migrate dev`
- Modify: `lib/env.ts` (`RELOCK_SECONDS`, optional `CRON_SECRET`)
- Create: `lib/locks/relock.ts`
- Modify: `lib/shares/redeem.ts`
- Modify: `app/share/[token]/actions.ts`
- Modify: `app/share/[token]/page.tsx`
- Modify: `components/guest-unlock.tsx`
- Create: `app/api/cron/relock/route.ts`, `vercel.json`
- Modify: `.env.example`, `.env.test.example`, `README.md`, `docs/pilot-setup-guide.md`
- Test: `tests/locks/relock.test.ts`, `tests/shares/redeem.test.ts`, `e2e/share-flow.spec.ts`

**Interfaces:**
- Consumes: `prisma`, `MockLockProvider`, `getLockProvider()`, `hashShareToken(token)`, the existing `RedeemResult` and `LockProvider` contract.
- Produces:
  - `Locker.relockAt: Date | null`
  - `RedeemResult = { ok: true; relockAt: Date } | { ok: false; reason: ... }`
  - `relockShareToken(input: { token: string; provider?: LockProvider; now?: Date }): Promise<{ ok: true } | { ok: false; errorCode: string }>`
  - `relockDueLockers(input?: { now?: Date; provider?: LockProvider; limit?: number }): Promise<{ relocked: number; failed: number }>`
  - `GET /api/cron/relock` returning `{ relocked: number; failed: number }`
  - `RELOCK_SECONDS` env number, default `30`; `CRON_SECRET` optional string.

**Non-goals:** No owner auto-relock, no vendor-specific auto-lock setting, no delayed-job service in this task, and no change to the 30-second guest copy beyond making it true.

- [ ] **Step 1: Write the failing service tests**

Add to `tests/shares/redeem.test.ts`:

```ts
it("sets relockAt when a guest unlock succeeds", async () => {
  const now = new Date("2026-11-03T10:00:00.000Z")
  const result = await redeemShareToken({
    token,
    ip: "203.0.113.10",
    now,
    relockSeconds: 30,
    provider: new MockLockProvider(),
    limiter: allowAllLimiter(),
  })
  expect(result).toEqual({ ok: true, relockAt: new Date("2026-11-03T10:00:30.000Z") })
  const locker = await prisma.locker.findUniqueOrThrow({ where: { id: lockerId } })
  expect(locker.relockAt).toEqual(new Date("2026-11-03T10:00:30.000Z"))
})
```

Create `tests/locks/relock.test.ts` with:

```ts
it("locks the locker, clears relockAt, and records a system lock event", async () => {
  await prisma.locker.update({ where: { id: lockerId }, data: { relockAt: new Date("2026-11-03T10:00:30.000Z") } })
  const provider = new MockLockProvider()
  await provider.unlock(vendorLockId)

  await expect(relockShareToken({ token, provider, now: new Date("2026-11-03T10:00:31.000Z") })).resolves.toEqual({ ok: true })

  expect((await provider.getState(vendorLockId)).status).toBe("locked")
  const locker = await prisma.locker.findUniqueOrThrow({ where: { id: lockerId } })
  expect(locker.relockAt).toBeNull()
  expect(locker.status).toBe("LOCKED")
  const event = await prisma.lockEvent.findFirstOrThrow({ where: { lockerId, actorType: "SYSTEM" } })
  expect(event).toMatchObject({ action: "LOCK", success: true })
})

it("relocks only due lockers and records failures", async () => {
  const provider = new MockLockProvider()
  await provider.unlock(vendorLockId)
  await prisma.locker.update({ where: { id: lockerId }, data: { relockAt: new Date("2026-11-03T10:00:00.000Z") } })
  await expect(relockDueLockers({ provider, now: new Date("2026-11-03T10:00:01.000Z") })).resolves.toEqual({ relocked: 1, failed: 0 })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test tests/shares/redeem.test.ts tests/locks/relock.test.ts`
Expected: FAIL because `Locker.relockAt`, `relockSeconds`, `relockShareToken`, and `relockDueLockers` do not exist.

- [ ] **Step 3: Add the schema and env values**

Add `relockAt DateTime?` to `Locker`. Run:

```bash
pnpm exec prisma migrate dev --name locker-relock-at
```

Add to `lib/env.ts`:

```ts
RELOCK_SECONDS: z.coerce.number().int().min(1).max(3600).default(30),
CRON_SECRET: z.string().min(16).optional(),
```

Add `RELOCK_SECONDS=30` and a commented `CRON_SECRET=` to `.env.example`; add `RELOCK_SECONDS=1` to `.env.test.example` so E2E is fast.

- [ ] **Step 4: Set and return the deadline on redeem**

In `lib/shares/redeem.ts`:

- Add `relockSeconds?: number` to `RedeemInput`; default from `getEnv().RELOCK_SECONDS`.
- Add `relockAt` to `ResolvedGrantData.locker` and select it in `resolveShareTokenAt`.
- Compute `const relockAt = new Date(now.getTime() + relockSeconds * 1000)`.
- In the success transaction, set `status: UNLOCKED`, `lastSyncedAt: now`, and `relockAt`.
- Return `{ ok: true, relockAt }`.
- Update the existing successful-redeem assertions in `tests/shares/redeem.test.ts` and `e2e/share-flow.spec.ts` so they expect the new deadline instead of `{ ok: true }` alone.

Do not change the failure reasons or the atomic claim logic.

- [ ] **Step 5: Implement the relock service**

Create `lib/locks/relock.ts` with the two interfaces above. `relockShareToken`:

1. Look up the grant by `hashShareToken(token)` even if it is expired or revoked.
2. If the locker has no `relockAt`, return `{ ok: true }` (idempotent).
3. Call `provider.lock(vendorLockId)`.
4. On failure, create a failed `SYSTEM` / `LOCK` event and return `{ ok: false, errorCode }`.
5. On success, update the locker to `LOCKED`, clear `relockAt`, set `lastSyncedAt = now`, and create a successful `SYSTEM` / `LOCK` event in the same transaction.

`relockDueLockers` selects `relockAt: { lte: now }` and `deletedAt: null`, ordered by `relockAt`, limited to `limit ?? 50`, and calls the same lock/update path. Return the counts.

Relock finalization must claim the exact deadline it saw: conditionally update the locker from that `relockAt` to null before calling the provider. A worker that loses the claim returns `{ ok: true }` without touching the locker, so a later unlock's fresh deadline is never cleared and duplicate client/cron calls produce one provider command and one success event. On failure, restore the claimed deadline only if no newer command owns the locker. Redeem persists `relockAt` before the provider unlock so a crash after the hardware call still leaves a deadline for the cron. Owner lock/unlock clears any pending guest deadline; owner commands stay manual.

- [ ] **Step 6: Expose the client relock action and cron route**

In `app/share/[token]/actions.ts`, update the result type so the client receives the deadline:

```ts
export type GuestRedeemResult =
  | { ok: true; relockAt: Date; canUnlockAgain: boolean }
  | Exclude<RedeemResult, { ok: true }>

export async function relockShare(token: string): Promise<{ ok: boolean; errorCode?: string }> {
  return relockShareToken({ token })
}
```

In `redeemShare`, return `{ ok: true, relockAt: result.relockAt, canUnlockAgain }` after the successful redeem and keep the existing follow-up status read.

Create `app/api/cron/relock/route.ts`:

```ts
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const secret = getEnv().CRON_SECRET
  if (!secret) return Response.json({ error: "cron_not_configured" }, { status: 503 })
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }
  return Response.json(await relockDueLockers())
}
```

Create `vercel.json` with a one-minute cron for `/api/cron/relock`. If the deployed plan does not allow one-minute crons, document the external scheduler alternative in the pilot guide.

- [ ] **Step 7: Make the guest UI use the server deadline**

In `app/share/[token]/page.tsx`, pass `initialRelockAt={result.grant.locker.relockAt?.toISOString() ?? null}` to `GuestUnlock`.

In `components/guest-unlock.tsx`:

- Accept `initialRelockAt?: string | null`.
- Store `relockAt` as an epoch number. Derive `secondsRemaining` from `relockAt - Date.now()` with a one-second interval, not a local 30-countdown.
- On a successful unlock, use `result.relockAt` from the server.
- At zero, call `relockShare(token)`. On success set `relockAt` to null and show `Locker relocked.` On failure show `The locker didn't relock. Try again.` with a `Try relock` button.
- Disable the unlock button while `relockAt` is in the future.
- Do not render `It will relock automatically` until the server deadline exists and the relock call is wired.

- [ ] **Step 8: Run the unit tests to verify they pass**

Run: `pnpm test tests/shares/redeem.test.ts tests/locks/relock.test.ts`
Expected: PASS.

- [ ] **Step 9: Run the E2E test and make it prove the relock**

Update `e2e/share-flow.spec.ts` after the guest unlock:

```ts
await expect(guestPage.getByText("Locker unlocked")).toBeVisible()
await expect(guestPage.getByText("Locker relocked.")).toBeVisible({ timeout: 5_000 })
const lockerId = new URL(owner.url()).pathname.split("/").at(-1)
await expect.poll(async () => {
  const response = await owner.request.get(`/api/lockers/${lockerId}/state`)
  return (await response.json()).status
}).toBe("locked")
```

Run: `pnpm test:e2e e2e/share-flow.spec.ts`
Expected: PASS with `RELOCK_SECONDS=1`.

- [ ] **Step 10: Update the docs**

- `README.md`: add `RELOCK_SECONDS` and `CRON_SECRET` to the configuration table; explain that the guest timer is server-backed and the cron is the fallback for closed tabs.
- `docs/pilot-setup-guide.md`: add the cron requirement and a guest check that the locker returns to locked after the countdown; document the one-minute scheduler limitation.

- [ ] **Step 11: Run the full verification**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`
Expected: lint clean, typecheck clean, all unit tests pass, build passes, and every E2E test passes.

- [ ] **Step 12: Commit**

```bash
git add prisma lib app components tests e2e vercel.json .env.example .env.test.example README.md docs/pilot-setup-guide.md
git commit -m "fix: relock guest unlocks and report relock state"
```
