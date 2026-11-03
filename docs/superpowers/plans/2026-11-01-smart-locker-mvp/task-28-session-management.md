# Task 28: Session management and profile editing

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Pilot hardening and growth design](../../specs/2026-11-03-smart-locker-pilot-hardening-design.md).
> Phase 2. **Depends on:** Task 04, Task 09.

---

**Files:**
- Create: `components/profile-name-form.tsx`, `components/session-list.tsx`
- Modify: `prisma/schema.prisma` (`Session.createdAt`), migration
- Modify: `lib/auth/session.ts`, `app/actions/account.ts`, `app/dashboard/settings/page.tsx`
- Modify: `README.md`, `docs/pilot-setup-guide.md`
- Test: `tests/account/sessions.test.ts`, `tests/actions/account.test.ts`, `e2e/sessions.spec.ts`

**Interfaces:**
- Consumes: Auth.js database sessions, `cookies()`, `requireUser()`, `prisma`.
- Produces:
  - `Session.createdAt DateTime @default(now())`
  - `getCurrentSessionToken(): Promise<string | null>`
  - `revokeOtherSessions(input: { userId: string; currentToken: string | null }): Promise<{ revoked: number }>`
  - `updateDisplayName(input: { userId: string; name: string }): Promise<boolean>`
  - `revokeOtherSessionsAction(): Promise<{ revoked: number }>` and `updateDisplayNameAction(formData: FormData): Promise<boolean>`

**Non-goals:** No email change, no password, no device fingerprinting, no raw IP or user-agent display, and no session history beyond the current active rows.

- [ ] **Step 1: Write the failing session test**

Create `tests/account/sessions.test.ts`:

```ts
it("revokes every session except the current one", async () => {
  const current = await seedSession({ userId, token: "current" })
  const other = await seedSession({ userId, token: "other" })
  await expect(revokeOtherSessions({ userId, currentToken: current.sessionToken })).resolves.toEqual({ revoked: 1 })
  await expect(prisma.session.findUnique({ where: { id: current.id } })).resolves.not.toBeNull()
  await expect(prisma.session.findUnique({ where: { id: other.id } })).resolves.toBeNull()
})

it("does not revoke another resident's sessions", async () => {
  const otherUserSession = await seedSession({ userId: otherUserId, token: "other-user" })
  await expect(revokeOtherSessions({ userId, currentToken: null })).resolves.toEqual({ revoked: 1 })
  await expect(prisma.session.findUnique({ where: { id: otherUserSession.id } })).resolves.not.toBeNull()
})
```

Add to `tests/actions/account.test.ts`:

```ts
it("rejects an empty or overlong display name", async () => {
  await expect(updateDisplayName({ userId, name: "   " })).resolves.toBe(false)
  await expect(updateDisplayName({ userId, name: "x".repeat(41) })).resolves.toBe(false)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test tests/account/sessions.test.ts tests/actions/account.test.ts`
Expected: FAIL because the session helpers and name update do not exist.

- [ ] **Step 3: Add the session timestamp**

Add `createdAt DateTime @default(now())` to `Session` and run:

```bash
pnpm exec prisma migrate dev --name session-created-at
```

Existing sessions get the migration timestamp, which is acceptable.

- [ ] **Step 4: Implement the session helpers**

In `lib/auth/session.ts`:

- `getCurrentSessionToken` reads `authjs.session-token` or `__Secure-authjs.session-token` from `cookies()` and returns the value or null.
- `revokeOtherSessions` calls `prisma.session.deleteMany({ where: { userId, ...(currentToken ? { NOT: { sessionToken: currentToken } } : {}) } })` and returns the count. If `currentToken` is null, revoke all sessions for that user; the caller must be authenticated.
- Add `listActiveSessions(userId)` returning `id`, `createdAt`, `expires` only, ordered newest first.

- [ ] **Step 5: Add the account actions**

In `app/actions/account.ts`:

- `updateDisplayName({ userId, name })`: trim, require 1–40 characters, update only that user, return a boolean.
- `updateDisplayNameAction(formData)`: require the current user, read `name`, call the service, `revalidatePath("/dashboard/settings")`, and return the result.
- `revokeOtherSessionsAction()`: require the current user, read the current token, call the service, and `revalidatePath("/dashboard/settings")`.

Use `requireUser()` for authorization; never accept a userId from the form.

- [ ] **Step 6: Add the settings UI**

In `app/dashboard/settings/page.tsx`, extend the Account card:

- Show the sign-in email as today.
- Add `ProfileNameForm` with the current `user.name ?? ""`, a `min-h-11` input, max length 40, pending state, and a success message.
- Add `SessionList` below the Account card with the active sessions: `This device` for the current token, `Created …`, `Expires …`, and a `Revoke other sessions` button with a confirmation dialog. After success, show `Other sessions revoked.` and refresh.
- Keep the email read-only; do not add an email-change control.

- [ ] **Step 7: Add the E2E test**

Create `e2e/sessions.spec.ts`:

```ts
test("a resident can revoke another browser session", async ({ browser }) => {
  const first = await browser.newContext()
  const second = await browser.newContext()
  await first.request.post("/api/test/session", { data: { email: "ana@example.com" } })
  await second.request.post("/api/test/session", { data: { email: "ana@example.com" } })

  const page = await first.newPage()
  await page.goto("/dashboard/settings")
  await expect(page.getByText("This device")).toBeVisible()
  await page.getByRole("button", { name: "Revoke other sessions" }).click()
  await page.getByRole("button", { name: "Revoke other sessions", exact: true }).last().click()

  const otherPage = await second.newPage()
  await otherPage.goto("/dashboard")
  await expect(otherPage).toHaveURL(/\/auth/)
})
```

Adjust the confirmation locator to the actual dialog labels. Run: `pnpm test:e2e e2e/sessions.spec.ts`
Expected: PASS.

- [ ] **Step 8: Update the docs**

- `README.md`: add session revocation and display-name editing to the Settings feature list.
- `docs/pilot-setup-guide.md`: add a resident acceptance step for signing in on two browsers and revoking the other session.

- [ ] **Step 9: Run the full verification**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`
Expected: lint clean, typecheck clean, all tests pass, build passes, and every E2E test passes.

- [ ] **Step 10: Commit**

```bash
git add prisma lib/auth/session.ts app/actions/account.ts app/dashboard/settings/page.tsx components/profile-name-form.tsx components/session-list.tsx tests/account tests/actions e2e/sessions.spec.ts README.md docs/pilot-setup-guide.md
git commit -m "feat: add session management and display-name editing"
```
