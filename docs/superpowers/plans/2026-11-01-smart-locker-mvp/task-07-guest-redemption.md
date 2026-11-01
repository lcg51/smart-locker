# Task 07: Public share page, atomic redemption, and rate limiting

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Smart Locker MVP — Design](../../specs/2026-11-01-smart-locker-mvp-design.md).
> Phase 1 (mock provider). **Depends on:** Task 02, Task 03, Task 06.

---

**Files:**
- Create: `lib/rate-limit.ts`, `lib/shares/redeem.ts`, `app/share/[token]/page.tsx`, `app/share/[token]/actions.ts`, `components/guest-unlock.tsx`
- Create: `tests/rate-limit.test.ts`, `tests/shares/redeem.test.ts`

**Interfaces:**
- Consumes: `prisma`, `hashShareToken()`, `LockProvider`, `getLockProvider()`, `getEnv()`.
- Produces: `RateLimiter` with `check(key: string, limit: number, windowMs: number): Promise<boolean>`; `createInMemoryRateLimiter(now?: () => number): RateLimiter`; `getRateLimiter(): RateLimiter`; `resolveShareToken(token: string): Promise<ResolvedGrant | GrantFailure>`; `redeemShareToken(input: RedeemInput): Promise<RedeemResult>` where `RedeemInput = { token: string; ip: string; provider?: LockProvider; limiter?: RateLimiter; sendEmail?: GuestUnlockEmailSender; now?: Date }`, `RedeemResult = { ok: true } | { ok: false; reason: "not_found" | "revoked" | "expired" | "exhausted" | "rate_limited" | "lock_failed" }`, and `GuestUnlockEmailSender = (input: GuestUnlockEmailInput) => Promise<boolean>`; `GuestUnlockEmailInput = { to: string; lockerName: string; guestLabel: string | null; unlockedAt: Date }` (declared in `lib/email.ts` in this task and implemented in Task 8).

- [ ] **Step 1: Write the failing rate-limit test**

Create `tests/rate-limit.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { createInMemoryRateLimiter } from "@/lib/rate-limit"

describe("createInMemoryRateLimiter", () => {
  it("allows the limit and rejects the next call in the window", async () => {
    const limiter = createInMemoryRateLimiter(() => 1_000)
    for (let i = 0; i < 10; i += 1) {
      await expect(limiter.check("ip:1", 10, 60_000)).resolves.toBe(true)
    }
    await expect(limiter.check("ip:1", 10, 60_000)).resolves.toBe(false)
  })

  it("starts fresh after the window", async () => {
    let now = 1_000
    const limiter = createInMemoryRateLimiter(() => now)
    await limiter.check("ip:1", 1, 60_000)
    now = 62_000
    await expect(limiter.check("ip:1", 1, 60_000)).resolves.toBe(true)
  })
})
```

- [ ] **Step 2: Write the failing redemption tests**

Create `tests/shares/redeem.test.ts` with the Task 5/6 seed helper and these cases:

```ts
it("redeems a valid link and records a guest event", async () => {
  const { userId, locker } = await seed()
  const { token } = await createShareGrant({ userId, lockerId: locker.id, maxUses: 1 })
  const result = await redeemShareToken({ token, ip: "1.1.1.1", provider: new MockLockProvider() })

  expect(result).toEqual({ ok: true })
  expect(await prisma.lockEvent.count({ where: { actorType: "GUEST", success: true } })).toBe(1)
})

it("fails closed for expired, revoked, exhausted, and unknown links", async () => {
  const { userId, locker } = await seed()
  const { token, grant } = await createShareGrant({ userId, lockerId: locker.id, maxUses: 1 })

  await prisma.shareGrant.update({ where: { id: grant.id }, data: { expiresAt: new Date(Date.now() - 1) } })
  await expect(redeemShareToken({ token, ip: "1.1.1.1" })).resolves.toEqual({ ok: false, reason: "expired" })

  await prisma.shareGrant.update({ where: { id: grant.id }, data: { expiresAt: new Date(Date.now() + 60_000), revokedAt: new Date() } })
  await expect(redeemShareToken({ token, ip: "1.1.1.1" })).resolves.toEqual({ ok: false, reason: "revoked" })

  await expect(redeemShareToken({ token: "unknown", ip: "1.1.1.1" })).resolves.toEqual({ ok: false, reason: "not_found" })
})

it("lets exactly one of two concurrent redemptions through a maxUses: 1 grant", async () => {
  const { userId, locker } = await seed()
  const { token, grant } = await createShareGrant({ userId, lockerId: locker.id, maxUses: 1 })
  const provider = new MockLockProvider()

  const results = await Promise.all([
    redeemShareToken({ token, ip: "1.1.1.1", provider }),
    redeemShareToken({ token, ip: "1.1.1.2", provider }),
  ])

  expect(results.filter((result) => result.ok)).toHaveLength(1)
  expect((await prisma.shareGrant.findUniqueOrThrow({ where: { id: grant.id } })).usedCount).toBe(1)
})

it("does not consume a use when the lock fails", async () => {
  const { userId, locker } = await seed()
  const { token, grant } = await createShareGrant({ userId, lockerId: locker.id, maxUses: 1 })
  const provider = new MockLockProvider({ failNextUnlock: true })

  await expect(redeemShareToken({ token, ip: "1.1.1.1", provider })).resolves.toEqual({ ok: false, reason: "lock_failed" })
  expect((await prisma.shareGrant.findUniqueOrThrow({ where: { id: grant.id } })).usedCount).toBe(0)
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm test tests/rate-limit.test.ts tests/shares/redeem.test.ts`
Expected: FAIL because the modules do not exist.

- [ ] **Step 4: Implement the rate limiter**

Create `lib/rate-limit.ts` with the `RateLimiter` interface and an in-memory implementation keyed by string, storing `{ count, resetAt }`. `getRateLimiter()` uses Upstash when both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are present, otherwise the in-memory limiter.

- [ ] **Step 5: Implement resolution and redemption**

Create `lib/shares/redeem.ts`:

- `resolveShareToken(token)` finds the grant by `hashShareToken(token)` with `locker` and `locker.user` included, then returns `{ ok: false, reason }` for `not_found`, `revoked`, `expired`, or `exhausted`, or `{ ok: true, grant }`.
- `redeemShareToken({ token, ip, provider, limiter = getRateLimiter(), sendEmail = sendGuestUnlockEmail, now = new Date() })`:
  1. Resolve the provider with `provider ?? await getLockProvider()`.
  2. Check `share:ip:<ip>` at 10/60s and `share:token:<hash>` at 20/60s; return `{ ok: false, reason: "rate_limited" }` on either failure.
  3. Resolve the grant and fail closed.
  4. Atomically claim a use with raw SQL:
     ```sql
     UPDATE "ShareGrant"
     SET "usedCount" = "usedCount" + 1
     WHERE "tokenHash" = $1
       AND "revokedAt" IS NULL
       AND "expiresAt" > $2
       AND "usedCount" < "maxUses"
     ```
     Use `prisma.$executeRaw` with the hash and `now`. If the row count is 0, resolve again and return its failure reason.
  5. Call `provider.unlock(grant.locker.vendorLockId)`. On failure or throw, decrement `usedCount` with `GREATEST("usedCount" - 1, 0)`, write a failed `GUEST`/`UNLOCK` event, and return `{ ok: false, reason: "lock_failed" }`.
  6. On success, update the locker status to `UNLOCKED` and `lastSyncedAt`, write a successful `GUEST`/`UNLOCK` event with `grantId`, then call `sendEmail` when `grant.locker.user.guestUnlockEmails` is true. Email failure is logged and never changes the result.
  7. Return `{ ok: true }`.

`sendGuestUnlockEmail` arrives in Task 8; until then declare `GuestUnlockEmailInput` and a temporary `sendGuestUnlockEmail` in `lib/email.ts` that returns `false`, and replace it in Task 8. `sendEmail` is optional in `RedeemInput` and defaults to `sendGuestUnlockEmail`.

- [ ] **Step 6: Add the public page and action**

Create `app/share/[token]/page.tsx` as a server component with `export const metadata: Metadata = { referrer: "no-referrer" }`. In Next 16 `params` is a Promise; await it, then resolve the token. On failure show the same generic message ("This link is no longer available") for every reason. On success show the locker name, guest label, expiry, and `<GuestUnlock />`.

Create `app/share/[token]/actions.ts` with a `redeemShare(token: string)` action that reads the client IP from `x-forwarded-for` (first entry) or `"unknown"` and calls `redeemShareToken`.

Create `components/guest-unlock.tsx` as a client component with an Unlock button, a pending state, an error message, and on success a confirmation plus a 30-second countdown to auto-relock. Do not call `router.refresh()` after success: the grant may now be exhausted, and a refresh would replace the success message with the generic failure page.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm test tests/rate-limit.test.ts tests/shares/redeem.test.ts`
Expected: PASS (including the concurrency and failed-unlock cases).

- [ ] **Step 8: Commit**

```bash
git add lib/rate-limit.ts lib/shares/redeem.ts lib/email.ts app/share components/guest-unlock.tsx tests/rate-limit.test.ts tests/shares/redeem.test.ts
git commit -m "feat: add guest share redemption with atomic use limits"
```
