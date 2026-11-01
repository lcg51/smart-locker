# Task 10: Onboarding, rename, and confirmation

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Smart Locker MVP — Design](../../specs/2026-11-01-smart-locker-mvp-design.md).
> Phase 1 (mock provider). **Depends on:** Task 02, Task 05.

---

**Files:**
- Create: `app/onboarding/page.tsx`, `components/locker-name-form.tsx`
- Modify: `app/actions/lockers.ts`, `app/dashboard/page.tsx`
- Create: `tests/lockers/rename.test.ts`

**Interfaces:**
- Consumes: `prisma`, `getLockersForUser()`.
- Produces: `renameLocker(input: { userId: string; lockerId: string; name: string }): Promise<boolean>`; `confirmLocker(input: { userId: string; lockerId: string }): Promise<boolean>`.

- [ ] **Step 1: Write the failing test**

This test reuses the Task 5 `seed()` helper. Import `prisma`, `renameLocker`, and `confirmLocker`.

Create `tests/lockers/rename.test.ts`:

```ts
it("renames and confirms only the owner's locker", async () => {
  const { userId, locker } = await seed()
  const stranger = await prisma.user.create({ data: { email: "stranger@example.com" } })

  await expect(renameLocker({ userId: stranger.id, lockerId: locker.id, name: "Mine" })).resolves.toBe(false)
  await expect(renameLocker({ userId, lockerId: locker.id, name: "  Pantry  " })).resolves.toBe(true)

  const updated = await prisma.locker.findUniqueOrThrow({ where: { id: locker.id } })
  expect(updated.name).toBe("Pantry")
  expect(updated.confirmedAt).toBeNull()

  await expect(confirmLocker({ userId, lockerId: locker.id })).resolves.toBe(true)
  expect((await prisma.locker.findUniqueOrThrow({ where: { id: locker.id } })).confirmedAt).not.toBeNull()
})

it("rejects an empty or overlong name", async () => {
  const { userId, locker } = await seed()
  await expect(renameLocker({ userId, lockerId: locker.id, name: "   " })).resolves.toBe(false)
  await expect(renameLocker({ userId, lockerId: locker.id, name: "x".repeat(41) })).resolves.toBe(false)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/lockers/rename.test.ts`
Expected: FAIL because `renameLocker` and `confirmLocker` do not exist.

- [ ] **Step 3: Implement rename and confirm**

Add to `lib/lockers/service.ts`: `renameLocker` trims the name, accepts 1..40 characters, and uses `updateMany` scoped to `id`, `userId`, and `deletedAt: null`. `confirmLocker` uses the same scope and sets `confirmedAt: new Date()`. Both return `count === 1`.

Add `renameLockerAction(lockerId, formData)` and `confirmLockerAction(lockerId)` to `app/actions/lockers.ts`.

- [ ] **Step 4: Add the onboarding page**

Create `app/onboarding/page.tsx`: `requireUser()`, load the user's lockers, redirect to `/dashboard` when every locker has `confirmedAt`. Otherwise show each locker with `<LockerNameForm />` and a Confirm button. Create `components/locker-name-form.tsx` as a client component with a text input and submit.

- [ ] **Step 5: Redirect unconfirmed residents to onboarding**

In `app/dashboard/page.tsx`, after loading the user's lockers, redirect to `/onboarding` when at least one locker is unconfirmed. Keep the empty state for residents with no lockers. The dashboard must not silently accept an unconfirmed locker: onboarding is where a new resident confirms the lockers ops pre-provisioned for them.

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm test tests/lockers/rename.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/onboarding components/locker-name-form.tsx app/actions/lockers.ts lib/lockers/service.ts app/dashboard/page.tsx tests/lockers/rename.test.ts
git commit -m "feat: add locker onboarding, rename, and confirmation"
```
