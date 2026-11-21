# Task 32: TTLock API quota reduction and guard

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Pilot hardening and growth design](../../specs/2026-11-03-smart-locker-pilot-hardening-design.md).
> Phase 2.5. **Depends on:** Task 15, Task 16.

---

**Goal:** keep the pilot inside the TTLock monthly call quota. Remove the background polling, reuse recent state, and stop non-essential calls before the quota is exceeded instead of failing a resident's unlock.

**Files:**
- Create: `lib/locks/quota.ts`, `scripts/ttlock-usage.ts`
- Modify: `lib/locks/ttlock.ts`, `lib/locks/index.ts`, `lib/lockers/service.ts`, `lib/env.ts`, `prisma/schema.prisma`, `hooks/use-locker-command.ts`, `package.json`, `README.md`, `.env.test.example`
- Create: `tests/locks/quota.test.ts`, `tests/locks/token-refresh.test.ts`
- Modify: `tests/lockers/service.test.ts`, `tests/locks/ttlock-client.test.ts`, `tests/locks/factory.test.ts`

**Interfaces:**
- Consumes: `TTLockClient` and `TTLockProvider` (Task 15), `refreshLockerState` and `runLockCommand` (`lib/lockers/service.ts`), `prisma`, `getEnv()`.
- Produces: `ttlockPeriod(now: Date): string`, `checkQuota(input: { vendor: string; kind: "state" | "command" | "admin"; now?: Date }): Promise<"ok" | "soft_limited" | "hard_limited">`, `recordVendorCall(vendor: string, count?: number): Promise<void>`, and the `quota_exceeded` error code in `LockerActionResult`.

**Before writing code, confirm on the TTLock developer console:** the account's monthly call limit. Record it in the task's PR description. Do not invent a number.

**Non-goals:** No change to the provider interface, no hardware change, no migration to local control (Task 33), no on-premise work (Task 34).

- [ ] **Step 1: Add the usage table**

Add to `prisma/schema.prisma`:

```prisma
model VendorApiCall {
  id        String   @id @default(cuid())
  vendor    String
  period    String
  count     Int      @default(0)
  updatedAt DateTime @updatedAt

  @@unique([vendor, period])
}
```

Run `pnpm db:migrate --name vendor_api_calls` and `pnpm db:generate`.

- [ ] **Step 2: Write the failing quota tests**

Create `tests/locks/quota.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { checkQuota, recordVendorCall, ttlockPeriod } from "@/lib/locks/quota"

describe("ttlockPeriod", () => {
  it("uses the Beijing (UTC+8) month, matching TTLock's counter", () => {
    expect(ttlockPeriod(new Date("2026-11-30T23:30:00.000Z"))).toBe("2026-12")
    expect(ttlockPeriod(new Date("2026-11-30T15:30:00.000Z"))).toBe("2026-11")
  })
})

describe("checkQuota", () => {
  it("allows calls below the soft limit", async () => {
    await recordVendorCall("ttlock", 3)
    await expect(checkQuota({ vendor: "ttlock", kind: "command" })).resolves.toBe("ok")
  })

  it("blocks state reads but allows commands above the soft limit", async () => {
    await recordVendorCall("ttlock", 90)
    await expect(checkQuota({ vendor: "ttlock", kind: "state" })).resolves.toBe("soft_limited")
    await expect(checkQuota({ vendor: "ttlock", kind: "command" })).resolves.toBe("ok")
  })

  it("blocks commands at the hard limit", async () => {
    await recordVendorCall("ttlock", 100)
    await expect(checkQuota({ vendor: "ttlock", kind: "command" })).resolves.toBe("hard_limited")
  })
})
```

Stub the env in `beforeEach` so the numbers are explicit and independent of `.env.test`:

```ts
beforeEach(async () => {
  vi.stubEnv("TTLOCK_MONTHLY_QUOTA", "100")
  vi.stubEnv("TTLOCK_QUOTA_SOFT_LIMIT_PERCENT", "80")
  resetEnvCacheForTests()
  await resetDb()
})
```

Use the same pattern as `tests/lockers/service.test.ts` (`vi.unstubAllEnvs` in a `beforeEach`, `resetDb()` from `tests/helpers/db.ts`).

Add two cases to `tests/lockers/service.test.ts`, using its existing `seed()` helper:

```ts
it("reuses a recent stored state instead of calling the provider", async () => {
  const { userId, locker } = await seed()
  await prisma.locker.update({
    where: { id: locker.id },
    data: { status: "LOCKED", lastSyncedAt: new Date(Date.now() - 5_000) },
  })
  const provider = { getState: vi.fn(), unlock: vi.fn(), lock: vi.fn(), provision: vi.fn() }

  await refreshLockerState({ userId, lockerId: locker.id, provider })

  expect(provider.getState).not.toHaveBeenCalled()
})

it("queries the provider when the stored state is older than the TTL", async () => {
  // lastSyncedAt 60s ago, LOCK_STATE_CACHE_SECONDS=30 -> getState called once
})
```

Create `tests/locks/token-refresh.test.ts`: assert that a stored token expiring in less than 7 days is refreshed with `grant_type=refresh_token`, and that the new token replaces the stored ciphertext.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm test tests/locks/quota.test.ts tests/lockers/service.test.ts tests/locks/token-refresh.test.ts`
Expected: FAIL because the modules and the cache branch do not exist.

- [ ] **Step 4: Implement quota accounting and the guard**

In `lib/locks/quota.ts`:

- `ttlockPeriod(now)` shifts the date by 8 hours, then formats `YYYY-MM` from the UTC fields.
- `recordVendorCall(vendor, count = 1)` upserts on `vendor_period` with `count: { increment: count }`.
- `checkQuota` reads the current period row and compares it with `TTLOCK_MONTHLY_QUOTA` (unset or `0` disables the guard). `kind: "state"` and `"admin"` return `soft_limited` at the soft percentage; `"command"` returns `ok` until the hard limit, then `hard_limited`.

Call `recordVendorCall("ttlock")` in `TTLockClient.send` after a successful response, and refuse to send when `checkQuota` returns `hard_limited`, or `soft_limited` for state reads. Do not count the `/app/getMonthRequestCount` call itself. Add `TTLOCK_MONTHLY_QUOTA` and `TTLOCK_QUOTA_SOFT_LIMIT_PERCENT` to `lib/env.ts` with defaults `0` and `80`.

- [ ] **Step 5: Use the quota guard in locker actions**

In `lib/lockers/service.ts`, map `quota_exceeded` from a blocked command to the existing `LockerActionResult` error channel. In `refreshLockerState`, return `quota_exceeded` instead of calling the provider when the guard says `soft_limited`, and serve the stored state when the cache is fresh.

Add the copy in `hooks/use-locker-command.ts`:

```ts
if (errorCode === "quota_exceeded") return "Locker commands are paused until the monthly quota resets. Try again next month."
```

Keep the existing success/error toasts and inline errors.

- [ ] **Step 6: Remove the background poll and add the cache TTL**

In `hooks/use-locker-command.ts`, delete the 30-second `setInterval`. Keep the initial refresh on mount, the "Refresh status" button, and the refresh after a command. Add a `visibilitychange` refresh only when the stored `lastSyncedAt` is older than `LOCK_STATE_CACHE_SECONDS`.

In `lib/lockers/service.ts`, add the cache branch to `refreshLockerState` using `LOCK_STATE_CACHE_SECONDS` (default `30`) and return the stored `status`, `batteryLevel`, `online: null` when fresh.

- [ ] **Step 7: Refresh the access token before expiry**

Store `expiresAt` with the token in `VendorCredential` (it is already part of the token object written by `pnpm seed-ttlock`). In `lib/locks/index.ts`, when the stored token expires in less than 7 days, call `POST /oauth2/token` with `grant_type=refresh_token`, `clientId`, `clientSecret`, and `refresh_token`, then re-encrypt and store the new token. A failed refresh leaves the current token in place and logs once.

- [ ] **Step 8: Add the usage report**

Create `scripts/ttlock-usage.ts` and the package script:

```json
"ttlock-usage": "dotenv -e .env.local -e . -- tsx scripts/ttlock-usage.ts"
```

It prints the TTLock `/app/getMonthRequestCount` value, the local `VendorApiCall` count for the current period, and the configured limit. Add the two env vars to the README table.

- [ ] **Step 9: Run the tests and the full gate**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`
Expected: all pass. The E2E suite must still see unlock and relock behavior on the mock provider.

- [ ] **Step 10: Measure, then commit**

With a real lock available, record calls for one day of pilot-like use and compare with the confirmed limit. Commit:

```bash
git add lib/locks/quota.ts lib/locks/ttlock.ts lib/locks/index.ts lib/lockers/service.ts lib/env.ts prisma/schema.prisma hooks/use-locker-command.ts scripts/ttlock-usage.ts package.json README.md .env.test.example tests/locks/quota.test.ts tests/locks/token-refresh.test.ts tests/lockers/service.test.ts tests/locks/ttlock-client.test.ts tests/locks/factory.test.ts
git commit -m "feat: guard TTLock quota and cut redundant state calls"
```

**Acceptance:**
- No timer polls the TTLock API.
- A dashboard visit with a fresh state makes no provider call.
- State reads stop at the soft limit; owner, guest, and relock commands keep working until the hard limit.
- A blocked call tells the resident why, in plain language.
- A token within 7 days of expiry refreshes without a manual seed run.
