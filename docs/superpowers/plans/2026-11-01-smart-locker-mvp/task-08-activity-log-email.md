# Task 08: Activity log and guest-unlock email

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Smart Locker MVP — Design](../../specs/2026-11-01-smart-locker-mvp-design.md).
> Phase 1 (mock provider). **Depends on:** Task 02, Task 07.

---

**Files:**
- Create: `lib/events/queries.ts`, `lib/email.ts`, `app/dashboard/activity/page.tsx`, `app/actions/account.ts`
- Modify: `lib/shares/redeem.ts` (send email)
- Create: `tests/events/queries.test.ts`, `tests/email/guest-unlock.test.ts`

**Interfaces:**
- Consumes: `prisma`, `getEnv()`, `redeemShareToken`.
- Produces: `listLockEvents(input: { userId: string; lockerId?: string; cursor?: string; limit?: number }): Promise<{ events: LockEvent[]; nextCursor: string | null }>`; `sendGuestUnlockEmail(input: GuestUnlockEmailInput): Promise<boolean>` where `GuestUnlockEmailInput = { to: string; lockerName: string; guestLabel: string | null; unlockedAt: Date }`; `setGuestUnlockEmails(userId: string, enabled: boolean): Promise<void>`.

- [ ] **Step 1: Write the failing activity and email tests**

Both files reuse the Task 5 `seed()` helper (provision `ana@example.com` with one `Kitchen` locker and return `{ userId, locker }`). Import `prisma`, `listLockEvents`, `redeemShareToken`, `createShareGrant`, `MockLockProvider`, and `GuestUnlockEmailInput` as needed.

Create `tests/events/queries.test.ts`:

```ts
it("returns only the owner's events, newest first, with a cursor", async () => {
  const { userId, locker } = await seed()
  const stranger = await prisma.user.create({ data: { email: "stranger@example.com" } })
  const strangerLocker = await prisma.locker.create({
    data: { userId: stranger.id, name: "Other", vendor: "mock", vendorLockId: "lock-9" },
  })
  for (let i = 0; i < 3; i += 1) {
    await prisma.lockEvent.create({
      data: { lockerId: locker.id, actorType: "OWNER", action: "UNLOCK", success: true },
    })
  }
  await prisma.lockEvent.create({
    data: { lockerId: strangerLocker.id, actorType: "OWNER", action: "UNLOCK", success: true },
  })

  const first = await listLockEvents({ userId, limit: 2 })
  expect(first.events).toHaveLength(2)
  expect(first.events.every((event) => event.lockerId === locker.id)).toBe(true)
  expect(first.nextCursor).not.toBeNull()

  const second = await listLockEvents({ userId, limit: 2, cursor: first.nextCursor! })
  expect(second.events).toHaveLength(1)
  expect(second.nextCursor).toBeNull()
})
```

Create `tests/email/guest-unlock.test.ts`:

```ts
it("sends one email for a guest unlock when enabled", async () => {
  const { userId, locker } = await seed()
  const { token } = await createShareGrant({ userId, lockerId: locker.id, guestLabel: "Ana" })
  const sent: GuestUnlockEmailInput[] = []

  await redeemShareToken({
    token,
    ip: "1.1.1.1",
    provider: new MockLockProvider(),
    sendEmail: async (input) => { sent.push(input); return true },
  })

  expect(sent).toHaveLength(1)
  expect(sent[0].lockerName).toBe("Kitchen")
  expect(sent[0].guestLabel).toBe("Ana")
})

it("still succeeds when the email sender throws", async () => {
  const { userId, locker } = await seed()
  const { token } = await createShareGrant({ userId, lockerId: locker.id })

  await expect(redeemShareToken({
    token,
    ip: "1.1.1.1",
    provider: new MockLockProvider(),
    sendEmail: async () => { throw new Error("smtp down") },
  })).resolves.toEqual({ ok: true })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test tests/events tests/email`
Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement the event query**

Create `lib/events/queries.ts`. Clamp `limit` to 1..100 with a default of 50. Filter by `locker: { userId }` and optionally `lockerId`. Order by `createdAt: "desc"` then `id: "desc"` (tie-breaker so cursor pagination is deterministic), take `limit + 1`, and use the last returned id as `nextCursor` when there is an extra row. When `cursor` is supplied, use Prisma's `cursor` with `skip: 1`.

- [ ] **Step 4: Implement the email sender and wire it into redemption**

Create `lib/email.ts` with `GuestUnlockEmailInput` and `sendGuestUnlockEmail` using `Resend` and `getEnv()`. Subject: `${lockerName} was unlocked`. Body names the guest label when present and includes the timestamp. Catch every error, log it, and return `false`.

In `lib/shares/redeem.ts`, replace the temporary `sendGuestUnlockEmail` with the real one and wrap the call in `try`/`catch` so a thrown sender cannot fail the unlock.

Add `setGuestUnlockEmails(userId, enabled)` to `app/actions/account.ts` as a `"use server"` action that updates `User.guestUnlockEmails` for the session user.

- [ ] **Step 5: Add the activity page**

Create `app/dashboard/activity/page.tsx`: `requireUser()`, read `lockerId` from search params, call `listLockEvents`, and render a table of time, locker name, actor, action, and success. Add a locker filter and a "Load more" link using the cursor. Empty state: "No activity yet."

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test tests/events tests/email`
Expected: PASS (including the throwing-sender case).

- [ ] **Step 7: Commit**

```bash
git add lib/events lib/email.ts lib/shares/redeem.ts app/dashboard/activity app/actions/account.ts tests/events tests/email
git commit -m "feat: add activity log and guest unlock email"
```
