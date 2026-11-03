# Task 20: Privacy pack and retention

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Pilot hardening and growth design](../../specs/2026-11-03-smart-locker-pilot-hardening-design.md).
> Phase 1.5. **Depends on:** Task 08, Task 09.

---

**Files:**
- Create: `app/privacy/page.tsx`, `lib/privacy/cleanup.ts`, `app/api/cron/cleanup/route.ts`
- Create: `docs/privacy/processor-region-checklist.md`
- Modify: `lib/env.ts` (`PRIVACY_CONTACT_EMAIL`)
- Modify: `vercel.json` (daily cleanup cron), `.env.example`, `.env.test.example`, `.github/workflows/ci.yml`
- Modify: `app/auth/page.tsx`, `app/dashboard/settings/page.tsx`, `README.md`, `docs/pilot-setup-guide.md`
- Test: `tests/privacy/cleanup.test.ts`, `e2e/privacy.spec.ts`

**Interfaces:**
- Consumes: `prisma`, `getEnv().CRON_SECRET`, the existing account-deletion path.
- Produces:
  - `cleanupExpiredData(input?: { now?: Date; retention?: Partial<RetentionPolicy> }): Promise<{ grants: number; sessions: number; verificationTokens: number; lockEvents: number }>`
  - `type RetentionPolicy = { inactiveGrantDays: number; expiredSessionDays: number; lockEventDays: number }`
  - `/privacy` page and `GET /api/cron/cleanup`
  - `PRIVACY_CONTACT_EMAIL` env string.

**Non-goals:** No consent-management platform, no cookie banner (the app uses only essential cookies and local storage), no legal advice, and no change to hard account deletion.

- [ ] **Step 1: Write the failing cleanup test**

Create `tests/privacy/cleanup.test.ts`:

```ts
it("deletes only inactive data older than the retention window", async () => {
  const now = new Date("2026-11-03T00:00:00.000Z")
  const oldGrant = await seedGrant({ expiresAt: new Date("2026-09-01T00:00:00.000Z") })
  const freshGrant = await seedGrant({ expiresAt: new Date("2026-11-02T00:00:00.000Z") })
  const oldSession = await seedSession({ expires: new Date("2026-09-01T00:00:00.000Z") })
  const freshSession = await seedSession({ expires: new Date("2026-11-02T00:00:00.000Z") })
  const oldEvent = await seedEvent({ createdAt: new Date("2025-09-01T00:00:00.000Z") })
  const freshEvent = await seedEvent({ createdAt: new Date("2026-10-01T00:00:00.000Z") })

  await expect(cleanupExpiredData({ now })).resolves.toEqual({
    grants: 1,
    sessions: 1,
    verificationTokens: 0,
    lockEvents: 1,
  })

  await expect(prisma.shareGrant.findUnique({ where: { id: oldGrant.id } })).resolves.toBeNull()
  await expect(prisma.shareGrant.findUnique({ where: { id: freshGrant.id } })).resolves.not.toBeNull()
  await expect(prisma.session.findUnique({ where: { id: oldSession.id } })).resolves.toBeNull()
  await expect(prisma.session.findUnique({ where: { id: freshSession.id } })).resolves.not.toBeNull()
  await expect(prisma.lockEvent.findUnique({ where: { id: oldEvent.id } })).resolves.toBeNull()
  await expect(prisma.lockEvent.findUnique({ where: { id: freshEvent.id } })).resolves.not.toBeNull()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/privacy/cleanup.test.ts`
Expected: FAIL because `cleanupExpiredData` does not exist.

- [ ] **Step 3: Implement the cleanup service**

Create `lib/privacy/cleanup.ts` with the interfaces above. Defaults: inactive grants 30 days, expired sessions and verification tokens 30 days, lock events 365 days. Delete:

- `shareGrant` where `expiresAt < inactiveCutoff` OR `revokedAt < inactiveCutoff`.
- `session` where `expires < sessionCutoff`.
- `verificationToken` where `expires < sessionCutoff`.
- `lockEvent` where `createdAt < eventCutoff`.

Run the deletes in one `prisma.$transaction` and return the counts. Deleting a grant sets `LockEvent.grantId` to null by the existing relation; it does not delete the event.

- [ ] **Step 4: Add the cron route and env**

Add `PRIVACY_CONTACT_EMAIL: z.string().email()` to `lib/env.ts`, plus values in `.env.example` and `.env.test.example`. Add `PRIVACY_CONTACT_EMAIL: privacy@example.com` to both CI job env blocks so `next build` and the unit suite can validate the env.

Create `app/api/cron/cleanup/route.ts` with the same `CRON_SECRET` check as Task 16 and `export const dynamic = "force-dynamic"`. Return the cleanup counts.

Add a daily cron to `vercel.json`:

```json
{ "path": "/api/cron/cleanup", "schedule": "0 3 * * *" }
```

- [ ] **Step 5: Write the privacy page**

Create `app/privacy/page.tsx` with sections: who controls the data and how to contact them (`getEnv().PRIVACY_CONTACT_EMAIL`), data collected, purposes and legal bases, processors, retention, deletion, rights, cookies and local storage, and the share-page analytics/no-referrer rules. Use the existing typography and `Card` components. Link it from the `/auth` footer and the Settings Account card.

- [ ] **Step 6: Write the processor checklist**

Create `docs/privacy/processor-region-checklist.md` with a table: processor, purpose, data, region, DPA status, subprocessors, transfer mechanism, owner, last reviewed. Include Vercel, the Postgres host, Resend, Upstash, TTLock (Phase 2), and the analytics provider. Mark every unknown as `TODO` rather than assuming compliance.

- [ ] **Step 7: Run the tests and page check**

Add `e2e/privacy.spec.ts`:

```ts
test("the privacy notice is reachable and names the contact", async ({ page }) => {
  await page.goto("/privacy")
  await expect(page.getByRole("heading", { name: "Privacy notice" })).toBeVisible()
  await expect(page.getByText(/retention/i)).toBeVisible()
})
```

Run: `pnpm test tests/privacy/cleanup.test.ts && pnpm test:e2e e2e/privacy.spec.ts`
Expected: PASS.

- [ ] **Step 8: Update the docs**

- `README.md`: link `/privacy` and list the retention windows.
- `docs/pilot-setup-guide.md`: add the privacy-policy review, the processor checklist, the cleanup cron, and the requirement to replace `PRIVACY_CONTACT_EMAIL` before inviting residents.

- [ ] **Step 9: Run the full verification**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`
Expected: lint clean, typecheck clean, all tests pass, build passes, and every E2E test passes.

- [ ] **Step 10: Commit**

```bash
git add app/privacy lib/privacy app/api/cron/cleanup docs/privacy lib/env.ts vercel.json .env.example .env.test.example .github/workflows/ci.yml app/auth/page.tsx app/dashboard/settings/page.tsx tests/privacy e2e/privacy.spec.ts README.md docs/pilot-setup-guide.md
git commit -m "feat: add privacy notice and data retention"
```
