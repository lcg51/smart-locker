# Task 03: Lock provider interface, mock provider, and factory

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Smart Locker MVP — Design](../../specs/2026-11-01-smart-locker-mvp-design.md).
> Phase 1 (mock provider). **Depends on:** Task 01.

---

**Files:**
- Create: `lib/locks/types.ts`, `lib/locks/mock.ts`, `lib/locks/index.ts`, `tests/locks/contract.ts`, `tests/locks/mock.test.ts`, `tests/locks/factory.test.ts`

**Interfaces:**
- Consumes: `getEnv()` from Task 1.
- Produces: `LockProvider`, `LockResult`, `LockerState`; `MockLockProvider`; `createLockProvider(config: { LOCK_PROVIDER: "mock" | "ttlock" }): Promise<LockProvider>`; `getLockProvider(): Promise<LockProvider>`.

- [ ] **Step 1: Write the failing contract test**

Create `tests/locks/contract.ts`:

```ts
import { describe, expect, it } from "vitest"
import type { LockProvider } from "@/lib/locks/types"

export function runLockProviderContract(name: string, create: () => LockProvider) {
  describe(`${name} contract`, () => {
    it("provisions a lock and reports it locked and online", async () => {
      const provider = create()
      const { vendorLockId } = await provider.provision({ name: "Kitchen" })
      expect(vendorLockId).toBeTruthy()
      await expect(provider.getState(vendorLockId)).resolves.toMatchObject({ status: "locked", online: true })
    })

    it("unlocks and locks a provisioned lock", async () => {
      const provider = create()
      const { vendorLockId } = await provider.provision({ name: "Kitchen" })
      await expect(provider.unlock(vendorLockId)).resolves.toEqual({ success: true })
      await expect(provider.getState(vendorLockId)).resolves.toMatchObject({ status: "unlocked" })
      await expect(provider.lock(vendorLockId)).resolves.toEqual({ success: true })
      await expect(provider.getState(vendorLockId)).resolves.toMatchObject({ status: "locked" })
    })

    it("fails an unknown lock without throwing", async () => {
      const provider = create()
      await expect(provider.unlock("missing")).resolves.toEqual({ success: false, errorCode: "unknown_lock" })
    })
  })
}
```

Create `tests/locks/mock.test.ts`:

```ts
import { MockLockProvider } from "@/lib/locks/mock"
import { runLockProviderContract } from "@/tests/locks/contract"

runLockProviderContract("MockLockProvider", () => new MockLockProvider({ strictUnknown: true }))
```

The contract suite runs in strict mode so its unknown-lock assertion is meaningful; the default mode is lenient for seeded fixtures (Step 4).

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/locks/mock.test.ts`
Expected: FAIL because `@/lib/locks/mock` does not exist.

- [ ] **Step 3: Implement the types**

Create `lib/locks/types.ts`:

```ts
export type LockStatusValue = "locked" | "unlocked" | "unknown"

export type LockResult = { success: true } | { success: false; errorCode: string }

export type LockerState = {
  status: LockStatusValue
  batteryLevel: number | null
  online: boolean
}

export interface LockProvider {
  provision(input: { name: string }): Promise<{ vendorLockId: string }>
  unlock(vendorLockId: string): Promise<LockResult>
  lock(vendorLockId: string): Promise<LockResult>
  getState(vendorLockId: string): Promise<LockerState>
}
```

- [ ] **Step 4: Implement the mock provider**

Create `lib/locks/mock.ts`. Keep an in-memory `Map<string, LockerState>` and a counter. `provision` creates `mock-<n>` with `{ status: "locked", batteryLevel: 100, online: true }`.

`unlock` and `lock` flip the status and return `{ success: true }`. By default, an unknown id is auto-registered first as `{ status: "locked", batteryLevel: 100, online: true }`, so seeded fixtures and the E2E can use stable vendor ids (`lock-1`, `e2e-lock-1`) without a provisioning round-trip. With `{ strictUnknown: true }`, an unknown id instead returns `{ success: false, errorCode: "unknown_lock" }`.

`getState` returns `{ status: "unknown", batteryLevel: null, online: false }` for an id that has never been seen. Accept an optional constructor option `{ failNextUnlock?: boolean }` that fails one unlock with `errorCode: "mock_failure"`.

- [ ] **Step 5: Implement the factory**

Create `lib/locks/index.ts`:

```ts
import { getEnv } from "@/lib/env"
import { MockLockProvider } from "@/lib/locks/mock"
import type { LockProvider } from "@/lib/locks/types"

export async function createLockProvider(config: { LOCK_PROVIDER: "mock" | "ttlock" }): Promise<LockProvider> {
  if (config.LOCK_PROVIDER === "mock") return new MockLockProvider()
  throw new Error("ttlock provider is not configured yet")
}

export function getLockProvider(): Promise<LockProvider> {
  return createLockProvider(getEnv())
}
```

Create `tests/locks/factory.test.ts` asserting `await createLockProvider({ LOCK_PROVIDER: "mock" })` implements the contract and `ttlock` rejects with `ttlock provider is not configured yet` until Task 14.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test tests/locks`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/locks tests/locks
git commit -m "feat: add lock provider interface and mock implementation"
```
