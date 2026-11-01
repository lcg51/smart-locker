# Task 06: Share grant creation, revocation, and owner UI

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Smart Locker MVP — Design](../../specs/2026-11-01-smart-locker-mvp-design.md).
> Phase 1 (mock provider). **Depends on:** Task 02, Task 05.

---

**Files:**
- Create: `lib/shares/token.ts`, `lib/shares/service.ts`, `app/actions/shares.ts`, `app/dashboard/lockers/[id]/page.tsx`, `components/share-dialog.tsx`, `components/active-shares.tsx`
- Create: `tests/shares/token.test.ts`, `tests/shares/service.test.ts`

**Interfaces:**
- Consumes: `prisma`, `getLockerForUser()`, `getEnv()`.
- Produces: `generateShareToken(): string`, `hashShareToken(token: string): string`, `createShareGrant(input: CreateShareInput): Promise<{ token: string; grant: ShareGrant }>`, `revokeShareGrant(input: { userId: string; grantId: string }): Promise<boolean>`, `listActiveGrants(input: { userId: string; lockerId: string }): Promise<ShareGrant[]>`.

- [ ] **Step 1: Write the failing token and service tests**

Create `tests/shares/token.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { generateShareToken, hashShareToken } from "@/lib/shares/token"

describe("share tokens", () => {
  it("generates 32 random bytes as base64url", () => {
    const token = generateShareToken()
    expect(token).toHaveLength(43)
    expect(token).not.toBe(generateShareToken())
  })

  it("hashes deterministically to 64 hex characters", () => {
    const token = generateShareToken()
    expect(hashShareToken(token)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashShareToken(token)).toBe(hashShareToken(token))
  })
})
```

Create `tests/shares/service.test.ts` with a `seed()` helper like Task 5 and these cases:

```ts
it("stores only the hash and applies the defaults", async () => {
  const { userId, locker } = await seed()
  const { token, grant } = await createShareGrant({ userId, lockerId: locker.id })

  expect(grant.tokenHash).toBe(hashShareToken(token))
  expect(grant.tokenHash).not.toBe(token)
  expect(grant.maxUses).toBe(5)
  expect(grant.expiresAt.getTime() - grant.createdAt.getTime()).toBeGreaterThanOrEqual(3_599_000)
})

it("rejects durations above 24 hours and use counts above 50", async () => {
  const { userId, locker } = await seed()
  await expect(createShareGrant({ userId, lockerId: locker.id, durationMinutes: 1441 })).rejects.toThrow("invalid_duration")
  await expect(createShareGrant({ userId, lockerId: locker.id, maxUses: 51 })).rejects.toThrow("invalid_max_uses")
})

it("does not let another resident create or revoke a grant", async () => {
  const { userId, locker } = await seed()
  const { grant } = await createShareGrant({ userId, lockerId: locker.id })
  const stranger = await prisma.user.create({ data: { email: "stranger@example.com" } })

  await expect(createShareGrant({ userId: stranger.id, lockerId: locker.id })).rejects.toThrow("locker_not_found")
  await expect(revokeShareGrant({ userId: stranger.id, grantId: grant.id })).resolves.toBe(false)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test tests/shares`
Expected: FAIL because the share modules do not exist.

- [ ] **Step 3: Implement tokens and the share service**

`lib/shares/token.ts` uses `node:crypto`: `randomBytes(32).toString("base64url")` and `createHash("sha256").update(token).digest("hex")`.

`lib/shares/service.ts`:

- `createShareGrant`: validate `durationMinutes` in 15..1440 (default 60) and `maxUses` in 1..50 (default 5), throwing `"invalid_duration"` or `"invalid_max_uses"`. Look up the locker with `getLockerForUser`, throwing `"locker_not_found"` when absent. Generate the token, compute `expiresAt`, and create the grant with `tokenHash`.
- `revokeShareGrant`: `updateMany` where `id`, `createdByUserId`, and `revokedAt: null`; set `revokedAt: new Date()`; return `count === 1`.
- `listActiveGrants`: filter by `lockerId`, `createdByUserId`, `revokedAt: null`, and `expiresAt > new Date()`, newest first.

- [ ] **Step 4: Add the owner UI**

Create `app/actions/shares.ts` with `createShare(lockerId, formData)` and `revokeShare(grantId)` actions. `createShare` returns `{ url: `${getEnv().APP_URL}/share/${token}`, grantId }`.

Create `app/dashboard/lockers/[id]/page.tsx`: load the locker and active grants for the user, 404 when the locker is not theirs, show state and a `ShareDialog`.

Create `components/share-dialog.tsx` as a client component with duration (15, 60, 240, 1440 minutes), guest label, max uses, a submit button, and a read-only input with `data-testid="share-url"` plus a copy button.

Create `components/active-shares.tsx` listing active grants with guest label, expiry, uses, and a Revoke button calling `revokeShare`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test tests/shares`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/shares app/actions/shares.ts app/dashboard/lockers components/share-dialog.tsx components/active-shares.tsx tests/shares
git commit -m "feat: add share grant creation and revocation"
```
