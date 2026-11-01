# Task 14: TTLock provider and credential encryption (Phase 2)

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Smart Locker MVP — Design](../../specs/2026-11-01-smart-locker-mvp-design.md).
> Phase 2 (TTLock). **Depends on:** Task 01, Task 02, Task 03.

---

**Files:**
- Create: `lib/crypto.ts`, `lib/locks/ttlock.ts`, `scripts/seed-vendor-credential.ts`
- Modify: `lib/locks/index.ts`
- Create: `tests/crypto.test.ts`, `tests/locks/ttlock.test.ts`

**Interfaces:**
- Consumes: `LockProvider`, `getEnv()`, `prisma`, `VendorCredential`.
- Produces: `encryptSecret(plaintext: string, keyHex: string): string`, `decryptSecret(ciphertext: string, keyHex: string): string`, `TTLockClient` with `post(path: string, body: Record<string, unknown>): Promise<unknown>`, and `TTLockProvider implements LockProvider`.

**Dependency:** Do not start this task until a TTLock developer account and a test lock exist. Phase 1 ships on `MockLockProvider`.

- [ ] **Step 1: Write the failing crypto and provider tests**

Create `tests/crypto.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { decryptSecret, encryptSecret } from "@/lib/crypto"

const key = "a".repeat(64)

describe("credential encryption", () => {
  it("round-trips a secret", () => {
    const ciphertext = encryptSecret("access-token", key)
    expect(ciphertext).not.toContain("access-token")
    expect(decryptSecret(ciphertext, key)).toBe("access-token")
  })

  it("rejects a tampered ciphertext", () => {
    const ciphertext = encryptSecret("access-token", key)
    const tampered = `${ciphertext.slice(0, -2)}aa`
    expect(() => decryptSecret(tampered, key)).toThrow()
  })
})
```

Create `tests/locks/ttlock.test.ts` with a fake `TTLockClient` and these cases:

```ts
it("maps a successful unlock response", async () => {
  const client = { post: async () => ({ errcode: 0 }) }
  await expect(new TTLockProvider(client).unlock("42")).resolves.toEqual({ success: true })
})

it("maps a vendor error to an error code", async () => {
  const client = { post: async () => ({ errcode: 30003, errmsg: "locked" }) }
  await expect(new TTLockProvider(client).unlock("42")).resolves.toEqual({ success: false, errorCode: "30003" })
})

it("maps state and battery", async () => {
  const client = { post: async () => ({ errcode: 0, state: 1, battery: 80 }) }
  await expect(new TTLockProvider(client).getState("42")).resolves.toEqual({
    status: "unlocked",
    batteryLevel: 80,
    online: true,
  })
})

it("returns a failure instead of throwing on network errors", async () => {
  const client = { post: async () => { throw new Error("timeout") } }
  await expect(new TTLockProvider(client).unlock("42")).resolves.toEqual({ success: false, errorCode: "network_error" })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test tests/crypto.test.ts tests/locks/ttlock.test.ts`
Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement AES-256-GCM encryption**

Create `lib/crypto.ts` with `node:crypto`: a 12-byte random IV, AES-256-GCM, and output `iv || authTag || ciphertext` as base64url. `decryptSecret` splits the parts, sets the auth tag, and returns UTF-8. A wrong key or tampered payload throws.

- [ ] **Step 4: Implement the TTLock provider**

Create `lib/locks/ttlock.ts`. `TTLockProvider` takes a `TTLockClient` and calls:

- `provision` -> `post("/v3/lock/initialize", { lockName: input.name })`, returning `String(response.lockId)`.
- `unlock` -> `post("/v3/lock/unlock", { lockId })`.
- `lock` -> `post("/v3/lock/lock", { lockId })`.
- `getState` -> `post("/v3/lock/query", { lockId })`.

Treat `errcode === 0` as success, any other `errcode` as `{ success: false, errorCode: String(errcode) }`, and a thrown client error as `network_error`. Map `state === 1` to `"unlocked"`, `state === 0` to `"locked"`, anything else to `"unknown"`. Battery is a number 0..100 or `null`.

TTLock's query endpoint can lag an unlock, and the dashboard polls `GET /api/lockers/[id]/state`; when the response is missing or ambiguous, return `"unknown"` rather than guessing a state. Do not add a webhook path in this task.

- [ ] **Step 5: Wire the factory and credential seeding**

Modify `lib/locks/index.ts`: for `"ttlock"`, read the `vendor: "ttlock"` credential, decrypt it with `CREDENTIAL_ENCRYPTION_KEY`, create an HTTP client against `TTLOCK_API_BASE` that appends the access token to every request body, and return `new TTLockProvider(client)`.

Create `scripts/seed-vendor-credential.ts`: read `TTLOCK_ACCESS_TOKEN` and `CREDENTIAL_ENCRYPTION_KEY`, encrypt the token, and upsert `VendorCredential` for `vendor: "ttlock"`.

- [ ] **Step 6: Run the tests and the full suite**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/crypto.ts lib/locks/ttlock.ts lib/locks/index.ts scripts/seed-vendor-credential.ts tests/crypto.test.ts tests/locks/ttlock.test.ts
git commit -m "feat: add TTLock provider and credential encryption"
```
