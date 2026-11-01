# Task 09: Settings and account deletion

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Smart Locker MVP — Design](../../specs/2026-11-01-smart-locker-mvp-design.md).
> Phase 1 (mock provider). **Depends on:** Task 04, Task 06, Task 07, Task 08.

---

**Files:**
- Create: `lib/account/delete.ts`, `app/dashboard/settings/page.tsx`, `components/delete-account-dialog.tsx`
- Modify: `app/actions/account.ts`
- Create: `tests/account/delete.test.ts`

**Interfaces:**
- Consumes: `prisma`, `requireUser()`, `signOut`.
- Produces: `deleteAccount(userId: string): Promise<void>`; `deleteAccountAction(): Promise<void>`.

- [ ] **Step 1: Write the failing deletion test**

This test reuses the Task 5 `seed()` helper. Import `prisma`, `createShareGrant`, `resolveShareToken`, and `deleteAccount`.

Create `tests/account/delete.test.ts`:

```ts
it("hard-deletes the account and every owned row, and kills share links", async () => {
  const { userId, locker } = await seed()
  const { token } = await createShareGrant({ userId, lockerId: locker.id })
  await prisma.session.create({
    data: { sessionToken: "session-1", userId, expires: new Date(Date.now() + 60_000) },
  })
  await prisma.lockEvent.create({
    data: { lockerId: locker.id, actorType: "OWNER", action: "UNLOCK", success: true },
  })

  await deleteAccount(userId)

  expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull()
  expect(await prisma.locker.count({ where: { userId } })).toBe(0)
  expect(await prisma.shareGrant.count({ where: { createdByUserId: userId } })).toBe(0)
  expect(await prisma.lockEvent.count({ where: { lockerId: locker.id } })).toBe(0)
  expect(await prisma.session.count({ where: { userId } })).toBe(0)
  expect(await prisma.allowedEmail.count({ where: { email: "ana@example.com" } })).toBe(0)
  await expect(resolveShareToken(token)).resolves.toEqual({ ok: false, reason: "not_found" })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/account/delete.test.ts`
Expected: FAIL because `@/lib/account/delete` does not exist.

- [ ] **Step 3: Implement deletion**

Create `lib/account/delete.ts` with `deleteAccount(userId)`. In one `prisma.$transaction`, delete in this order: `lockEvent` for the user's lockers, `shareGrant` for the user, `locker` for the user, `session`, `account`, then `user`, then `allowedEmail` matching the user's email. Read the email before deleting the user.

- [ ] **Step 4: Add the settings page and action**

Add `deleteAccountAction()` to `app/actions/account.ts`: `requireUser()`, call `deleteAccount(user.id)`, then `signOut({ redirectTo: "/auth" })`.

Create `app/dashboard/settings/page.tsx` with: account email, an email-notifications switch bound to `setGuestUnlockEmails`, a sign-out button, and a Danger Zone card with `<DeleteAccountDialog />`.

Create `components/delete-account-dialog.tsx` with an AlertDialog whose confirm button calls `deleteAccountAction`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test tests/account/delete.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/account app/dashboard/settings components/delete-account-dialog.tsx app/actions/account.ts tests/account/delete.test.ts
git commit -m "feat: add settings and hard account deletion"
```
