# Task 29: Share lifecycle audit and link extension

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Pilot hardening and growth design](../../specs/2026-11-03-smart-locker-pilot-hardening-design.md).
> Phase 2. **Depends on:** Task 06, Task 08.

---

**Files:**
- Modify: `prisma/schema.prisma` (`ShareGrantEvent`, `ShareAction`), migration
- Modify: `lib/shares/service.ts`
- Modify: `app/actions/shares.ts`
- Create: `components/share-history.tsx`, `components/extend-share-dialog.tsx`
- Modify: `components/active-shares.tsx`, `app/dashboard/lockers/[id]/page.tsx`
- Modify: `README.md`, `docs/pilot-setup-guide.md`
- Test: `tests/shares/service.test.ts`, `tests/shares/extension.test.ts`, `e2e/share-extension.spec.ts`

**Interfaces:**
- Consumes: `prisma`, `getLockerForUser`, existing share creation/revocation, `requireUser`.
- Produces:
  - `enum ShareAction { CREATED REVOKED EXTENDED }`
  - `ShareGrantEvent { id, grantId, grant, actorType ActorType, action ShareAction, detail String?, createdAt }`
  - `extendShareGrant(input: { userId: string; grantId: string; additionalMinutes?: number; additionalUses?: number; now?: Date }): Promise<{ ok: true; grant: ShareGrant } | { ok: false; error: "not_found" | "revoked" | "expired" | "invalid_extension" }>`
  - `listShareHistory({ userId: string; lockerId: string; limit?: number })`
  - `extendShare(grantId, formData): Promise<{ ok: boolean; error?: string }>`

**Non-goals:** No extension of revoked or expired links, no raw token in history, no bulk extension, and no change to the share-token hash model.

- [ ] **Step 1: Write the failing extension tests**

Create `tests/shares/extension.test.ts`:

```ts
it("extends a live grant within the caps and records an event", async () => {
  const now = new Date("2026-11-03T10:00:00.000Z")
  // createLiveGrant inserts a grant with this expiry and maxUses.
  const grant = await createLiveGrant({ expiresAt: new Date(now.getTime() + 30 * 60_000), maxUses: 5 })

  const result = await extendShareGrant({
    userId,
    grantId: grant.id,
    additionalMinutes: 60,
    additionalUses: 2,
    now,
  })

  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.grant.expiresAt).toEqual(new Date(now.getTime() + 90 * 60_000))
  expect(result.grant.maxUses).toBe(7)
  const event = await prisma.shareGrantEvent.findFirstOrThrow({ where: { grantId: grant.id } })
  expect(event).toMatchObject({ action: "EXTENDED", actorType: "OWNER", detail: "+60 minutes, +2 uses" })
})

it("refuses to extend a revoked or expired grant", async () => {
  const now = new Date("2026-11-03T10:00:00.000Z")
  const revoked = await createLiveGrant({ expiresAt: new Date(now.getTime() + 60 * 60_000), revokedAt: now })
  const expired = await createLiveGrant({ expiresAt: new Date(now.getTime() - 60_000) })

  await expect(extendShareGrant({ userId, grantId: revoked.id, additionalMinutes: 60, now }))
    .resolves.toEqual({ ok: false, error: "revoked" })
  await expect(extendShareGrant({ userId, grantId: expired.id, additionalMinutes: 60, now }))
    .resolves.toEqual({ ok: false, error: "expired" })
})

it("caps the expiry at 1440 minutes from the extension time and uses at 50", async () => {
  const now = new Date("2026-11-03T10:00:00.000Z")
  const live = await createLiveGrant({ expiresAt: new Date(now.getTime() + 30 * 60_000), maxUses: 5 })
  const result = await extendShareGrant({ userId, grantId: live.id, additionalMinutes: 2000, additionalUses: 100, now })
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.grant.expiresAt).toEqual(new Date(now.getTime() + 1440 * 60_000))
  expect(result.grant.maxUses).toBe(50)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test tests/shares/extension.test.ts`
Expected: FAIL because the model and service do not exist.

- [ ] **Step 3: Add the audit model**

Add to `prisma/schema.prisma`:

```prisma
enum ShareAction {
  CREATED
  REVOKED
  EXTENDED
}

model ShareGrantEvent {
  id        String      @id @default(cuid())
  grantId   String
  grant     ShareGrant  @relation(fields: [grantId], references: [id], onDelete: Cascade)
  actorType ActorType
  action    ShareAction
  detail    String?
  createdAt DateTime    @default(now())

  @@index([grantId, createdAt])
}
```

Add `events ShareGrantEvent[]` to `ShareGrant`. Run:

```bash
pnpm exec prisma migrate dev --name share-grant-events
```

- [ ] **Step 4: Write lifecycle events**

In `lib/shares/service.ts`:

- `createShareGrant` writes a `ShareGrantEvent` with `action: CREATED`, `actorType: OWNER`, and `detail` containing the duration and max uses in the same transaction as the grant create.
- `revokeShareGrant` writes a `REVOKED` event in the same transaction when the update affects one row.
- Keep the existing return types and authorization filters.

Add `listShareHistory({ userId, lockerId, limit = 20 })` that filters through `grant.locker.userId`, orders by `createdAt desc`, and selects `id`, `action`, `detail`, `createdAt`, `grant: { guestLabel }`.

- [ ] **Step 5: Implement extension**

Add `extendShareGrant` to `lib/shares/service.ts`:

1. Find the grant scoped by `createdByUserId` and locker ownership.
2. Return `not_found` if missing.
3. Return `revoked` if `revokedAt` is set.
4. Return `expired` if `expiresAt <= now`.
5. Require at least one positive integer for `additionalMinutes` or `additionalUses`; otherwise `invalid_extension`. The server caps the result rather than rejecting an over-large request.
6. Compute `newExpiresAt = min(max(expiresAt, now) + additionalMinutes * 60_000, now + 1440 * 60_000)`.
7. Compute `newMaxUses = min(50, max(maxUses, usedCount) + additionalUses)`; never lower it.
8. Update the grant and write the `EXTENDED` event in one transaction.
9. Return the updated grant.

- [ ] **Step 6: Add the action and UI**

In `app/actions/shares.ts`, add `extendShare(grantId, formData)` that requires the user, parses the two optional number fields, calls the service, revalidates the locker page, and returns `{ ok, error }`.

In `components/active-shares.tsx`, add an `Extend` button per live grant. It opens `ExtendShareDialog` with optional `Additional minutes` (15–1440) and `Additional unlocks` (1–50) fields. Show the current expiry and uses. On success, refresh the page and show the updated values.

Create `components/share-history.tsx` to render the create/revoke/extend events with localized labels and `formatEventTime` from Task 22. Add it to the locker detail page below the active shares.

- [ ] **Step 7: Add the E2E test**

Create `e2e/share-extension.spec.ts`:

```ts
test("an owner can extend a live share link", async ({ page, context }) => {
  await context.request.post("/api/test/session", { data: { email: "ana@example.com" } })
  await page.goto("/dashboard")
  await page.getByRole("link", { name: "Locker details" }).click()
  await page.getByRole("button", { name: "Share access" }).click()
  await page.getByLabel("Guest label").fill("Cleaner")
  await page.getByRole("button", { name: "Create share link" }).click()
  await page.getByRole("button", { name: "Close share dialog" }).click()

  await page.getByRole("button", { name: "Extend" }).click()
  await page.getByLabel("Additional minutes").fill("30")
  await page.getByLabel("Additional unlocks").fill("2")
  await page.getByRole("button", { name: "Extend link" }).click()

  await expect(page.getByText("7 unlocks used")).not.toBeVisible()
  await expect(page.getByText("Extended")).toBeVisible()
})
```

Adjust the final assertion to the rendered history text. Run: `pnpm test:e2e e2e/share-extension.spec.ts`
Expected: PASS.

- [ ] **Step 8: Update the docs**

- `README.md`: list share history and extension as owner features.
- `docs/pilot-setup-guide.md`: add a resident acceptance step for extending a link and confirming the old expiry/uses are not exceeded.

- [ ] **Step 9: Run the full verification**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`
Expected: lint clean, typecheck clean, all tests pass, build passes, and every E2E test passes.

- [ ] **Step 10: Commit**

```bash
git add prisma lib/shares app/actions/shares.ts components app/dashboard tests/shares e2e/share-extension.spec.ts README.md docs/pilot-setup-guide.md
git commit -m "feat: audit share lifecycle and allow safe link extension"
```
