# Task 05: Locker queries, unlock/lock service, and dashboard

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Smart Locker MVP — Design](../../specs/2026-11-01-smart-locker-mvp-design.md).
> Phase 1 (mock provider). **Depends on:** Task 02, Task 03, Task 04.

---

**Files:**
- Create: `lib/lockers/queries.ts`, `lib/lockers/service.ts`, `app/actions/lockers.ts`, `app/dashboard/layout.tsx`, `app/dashboard/page.tsx`, `app/api/lockers/[id]/state/route.ts`, `components/locker-card.tsx`, `app/actions/auth.ts`
- Modify: `components/header.tsx`
- Create: `tests/lockers/service.test.ts`

**Interfaces:**
- Consumes: `prisma`, `requireUser()`, `LockProvider`, `getLockProvider()`, `MockLockProvider`.
- Produces: `getLockersForUser(userId: string): Promise<Locker[]>`, `getLockerForUser(userId: string, lockerId: string): Promise<Locker | null>`, `unlockLockerForUser(input: LockerActionInput): Promise<LockerActionResult>`, `lockLockerForUser(input: LockerActionInput): Promise<LockerActionResult>`, `refreshLockerState(input: LockerActionInput): Promise<LockerActionResult>` where `LockerActionInput = { userId: string; lockerId: string; provider?: LockProvider }` and `LockerActionResult = { ok: boolean; errorCode?: string; state?: LockerState }`.

- [ ] **Step 1: Write the failing service test**

Create `tests/lockers/service.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { provisionApartment } from "@/lib/ops/provision"
import { unlockLockerForUser } from "@/lib/lockers/service"
import { MockLockProvider } from "@/lib/locks/mock"
import type { LockProvider } from "@/lib/locks/types"
import { resetDb } from "@/tests/helpers/db"

beforeEach(resetDb)

async function seed() {
  const { userId } = await provisionApartment({
    email: "ana@example.com",
    gatewayId: "gw-1",
    lockers: [{ name: "Kitchen", vendor: "mock", vendorLockId: "lock-1" }],
  })
  const locker = await prisma.locker.findFirstOrThrow({ where: { userId } })
  return { userId, locker }
}

describe("unlockLockerForUser", () => {
  it("unlocks the owner's locker and records an event", async () => {
    const { userId, locker } = await seed()
    const result = await unlockLockerForUser({ userId, lockerId: locker.id, provider: new MockLockProvider() })

    expect(result.ok).toBe(true)
    expect((await prisma.locker.findUniqueOrThrow({ where: { id: locker.id } })).status).toBe("UNLOCKED")
    expect(await prisma.lockEvent.count({ where: { lockerId: locker.id, success: true } })).toBe(1)
  })

  it("treats another resident's locker as not found and writes no event", async () => {
    const { locker } = await seed()
    const stranger = await prisma.user.create({ data: { email: "stranger@example.com" } })
    const result = await unlockLockerForUser({ userId: stranger.id, lockerId: locker.id, provider: new MockLockProvider() })

    expect(result).toEqual({ ok: false, errorCode: "not_found" })
    expect(await prisma.lockEvent.count()).toBe(0)
  })

  it("records a failure when the provider throws and a re-query is still unknown", async () => {
    const { userId, locker } = await seed()
    const provider = {
      unlock: async () => { throw new Error("timeout") },
      getState: async () => { throw new Error("timeout") },
    } as unknown as LockProvider
    const result = await unlockLockerForUser({ userId, lockerId: locker.id, provider })

    expect(result).toEqual({ ok: false, errorCode: "provider_error" })
    expect(await prisma.lockEvent.count({ where: { success: false, errorCode: "provider_error" } })).toBe(1)
  })

  it("treats an unlock as successful when a re-query confirms it", async () => {
    const { userId, locker } = await seed()
    const provider = {
      unlock: async () => { throw new Error("timeout") },
      getState: async () => ({ status: "unlocked", batteryLevel: 90, online: true }),
    } as unknown as LockProvider
    const result = await unlockLockerForUser({ userId, lockerId: locker.id, provider })

    expect(result.ok).toBe(true)
    expect(await prisma.lockEvent.count({ where: { success: true } })).toBe(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/lockers/service.test.ts`
Expected: FAIL because `@/lib/lockers/service` does not exist.

- [ ] **Step 3: Implement queries and service**

`lib/lockers/queries.ts` returns lockers where `userId` matches and `deletedAt: null`, ordered by `createdAt`. `getLockerForUser` returns `null` when the row is missing, belongs to another user, or is soft-deleted.

`lib/lockers/service.ts` implements `unlockLockerForUser` and `lockLockerForUser`:

1. Resolve the provider with `input.provider ?? await getLockProvider()`.
2. Look up the locker with `getLockerForUser`; return `{ ok: false, errorCode: "not_found" }` when absent.
3. Call `provider.unlock` or `provider.lock` inside `try`/`catch`.
4. On a thrown provider error, call `provider.getState` once. If it reports the intended end state (`unlocked` for unlock, `locked` for lock), treat the action as successful and continue to step 6. Otherwise write a failed event with `errorCode: "provider_error"` and return it.
5. On a failed result, write a failed event with the provider's `errorCode` and return it.
6. On success, call `provider.getState` when it has not already been read, then in one transaction update `status`, `batteryLevel`, and `lastSyncedAt`, and create a successful event with `actorType: "OWNER"` and the matching action.
7. Return `{ ok: true, state }`.

`refreshLockerState` resolves the provider the same way, looks up the locker, calls `provider.getState`, updates the cached status and battery, and returns `{ ok: true, state }`; it returns `{ ok: false, errorCode: "not_found" }` for another user's locker.

Map `"locked"` to `LockStatus.LOCKED`, `"unlocked"` to `LockStatus.UNLOCKED`, otherwise `LockStatus.UNKNOWN`.

- [ ] **Step 4: Add the dashboard and server actions**

Create `app/actions/auth.ts` with a `logout()` server action calling `signOut({ redirectTo: "/auth" })`.

Create `app/actions/lockers.ts` with `unlockLocker(lockerId: string)` and `lockLocker(lockerId: string)` actions: `requireUser()`, call the service, return the result.

Create `app/dashboard/layout.tsx`: `const user = await requireUser()`, render `<Header />` and `{children}`.

Create `app/dashboard/page.tsx`: load `getLockersForUser(user.id)`, show "Your lockers", an empty state when there are none, and a grid of `<LockerCard locker={locker} />`.

Create `app/api/lockers/[id]/state/route.ts` with a `GET` handler: `requireUser()`, call `refreshLockerState`, and return `{ status, batteryLevel, online }` or 404. This is the polling path the dashboard uses; signed vendor webhooks are post-MVP. In Next 16 the route context `params` is a Promise: type it as `{ params }: { params: Promise<{ id: string }> }` and use `const { id } = await params`.

Create `components/locker-card.tsx` as a client component. Show name, status badge, battery, an Unlock/Lock button that calls the server action inside `useTransition`, an inline error with a retry affordance, and a link to `/dashboard/lockers/[id]`. Call `router.refresh()` after a successful action. Poll `GET /api/lockers/[id]/state` every 30 seconds and update the displayed status and battery; stop polling on unmount.

Modify `components/header.tsx` to link to `/dashboard/activity` and `/dashboard/settings` and to submit a form with the `logout` action.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test tests/lockers/service.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/lockers app/actions app/dashboard components/locker-card.tsx components/header.tsx tests/lockers/service.test.ts
git commit -m "feat: add locker service and dashboard"
```
