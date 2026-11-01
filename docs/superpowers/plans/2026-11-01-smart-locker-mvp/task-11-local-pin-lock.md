# Task 11: Optional local PIN app lock

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Smart Locker MVP — Design](../../specs/2026-11-01-smart-locker-mvp-design.md).
> Phase 1 (mock provider). **Depends on:** Task 05, Task 09.

---

**Files:**
- Create: `lib/pin.ts`, `components/app-lock.tsx`, `components/pin-settings.tsx`
- Modify: `app/dashboard/layout.tsx`, `app/dashboard/settings/page.tsx`
- Create: `tests/pin.test.ts`

**Interfaces:**
- Consumes: `PinPad` from `@/components/pin-pad`.
- Produces: `generatePinSalt(): string`, `hashPin(pin: string, salt: string): Promise<string>`, `verifyPin(pin: string, salt: string, hash: string): Promise<boolean>`.

- [ ] **Step 1: Write the failing PIN test**

Create `tests/pin.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { generatePinSalt, hashPin, verifyPin } from "@/lib/pin"

describe("PIN hashing", () => {
  it("verifies the right PIN and rejects the wrong one", async () => {
    const salt = generatePinSalt()
    const hash = await hashPin("1234", salt)
    await expect(verifyPin("1234", salt, hash)).resolves.toBe(true)
    await expect(verifyPin("0000", salt, hash)).resolves.toBe(false)
  })

  it("produces a different hash with a different salt", async () => {
    const first = await hashPin("1234", generatePinSalt())
    const second = await hashPin("1234", generatePinSalt())
    expect(first).not.toBe(second)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/pin.test.ts`
Expected: FAIL because `@/lib/pin` does not exist.

- [ ] **Step 3: Implement PIN hashing**

Create `lib/pin.ts` using Web Crypto: a 16-byte random salt rendered as hex, and PBKDF2-SHA-256 with 100,000 iterations and a 256-bit output rendered as hex. `verifyPin` recomputes and compares strings.

- [ ] **Step 4: Add the app lock and settings**

Create `components/app-lock.tsx` as a client component. On mount, read `smart-locker-pin` from `localStorage`. If absent, render children. If present and `sessionStorage.getItem("smart-locker-unlocked") !== "1"`, render `PinPad`; on a correct PIN set the session flag and render children; on a wrong PIN show "Incorrect PIN" and reset. Include a "Sign out instead" link to `/auth`.

Modify `app/dashboard/layout.tsx` to wrap the header and children in `<AppLock>`.

Create `components/pin-settings.tsx` with Set PIN / Remove PIN controls and add it to the settings page. Copy must say this is a convenience lock on this device, not account security.

- [ ] **Step 5: Clear the local PIN on sign-out**

Signing out must clear both `smart-locker-pin` from `localStorage` and `smart-locker-unlocked` from `sessionStorage` before redirecting to `/auth`; otherwise the next person on the device inherits the convenience lock. The `logout` server action cannot touch browser storage, so add a small client component (or make the existing logout control client-side) that clears both keys, then calls `logout()`. Use the same control for the header's sign-out button and the AppLock "Sign out instead" link.

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm test tests/pin.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/pin.ts components/app-lock.tsx components/pin-settings.tsx components/header.tsx app/dashboard/layout.tsx app/dashboard/settings/page.tsx tests/pin.test.ts
git commit -m "feat: add optional local PIN app lock"
```
