# Task 30: Accessibility and security E2E coverage

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Pilot hardening and growth design](../../specs/2026-11-03-smart-locker-pilot-hardening-design.md).
> Phase 2. **Depends on:** Task 12, Task 14, Task 16, Task 17, Task 22.

---

**Files:**
- Create: `e2e/helpers.ts`, `e2e/security.spec.ts`, `e2e/accessibility.spec.ts`
- Modify: `package.json` (`@axe-core/playwright` devDependency), `playwright.config.ts` if a helper fixture is needed
- Modify: `README.md`, `docs/pilot-setup-guide.md`
- Test: the two new specs

**Interfaces:**
- Consumes: the test-session route, Prisma, the existing seed, `@axe-core/playwright`, and the share-creation service.
- Produces: repeatable E2E coverage for bearer-link failure modes, cross-user access, guest disclosure, headers, and serious/critical axe violations.

**Non-goals:** No penetration test, no load test, no visual-regression snapshots, and no production test backdoor beyond the existing `E2E=1` route.

- [ ] **Step 1: Add the accessibility dependency**

Run: `pnpm add -D @axe-core/playwright`
Expected: `package.json` and `pnpm-lock.yaml` change.

- [ ] **Step 2: Write the security spec first**

Create `e2e/helpers.ts` with:

```ts
export async function signIn(context: BrowserContext, email = "ana@example.com") {
  const response = await context.request.post("/api/test/session", { data: { email } })
  expect(response.status()).toBe(200)
}

export async function createShareForSeed(input: { durationMinutes?: number; maxUses?: number }) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: "ana@example.com" } })
  const locker = await prisma.locker.findFirstOrThrow({ where: { userId: user.id } })
  return createShareGrant({ userId: user.id, lockerId: locker.id, ...input })
}
```

Create `e2e/security.spec.ts` with four tests:

```ts
test("an expired link fails closed with the generic page", async ({ page }) => {
  const { token } = await createShareForSeed({ durationMinutes: 15 })
  await prisma.shareGrant.update({ where: { tokenHash: hashShareToken(token) }, data: { expiresAt: new Date(Date.now() - 1_000) } })
  await page.goto(`/share/${token}`)
  await expect(page.getByText("This link is no longer available")).toBeVisible()
})

test("a revoked link fails closed", async ({ page }) => {
  const { token, grant } = await createShareForSeed({ durationMinutes: 60 })
  await prisma.shareGrant.update({ where: { id: grant.id }, data: { revokedAt: new Date() } })
  await page.goto(`/share/${token}`)
  await expect(page.getByText("This link is no longer available")).toBeVisible()
})

test("a one-use link cannot be replayed", async ({ page }) => {
  const { token } = await createShareForSeed({ durationMinutes: 60, maxUses: 1 })
  await page.goto(`/share/${token}`)
  await page.getByRole("button", { name: "Unlock locker" }).click()
  await expect(page.getByText("Locker unlocked")).toBeVisible()
  await page.reload()
  await expect(page.getByText("This link is no longer available")).toBeVisible()
})

test("a resident cannot open another resident's locker", async ({ browser }) => {
  const other = await browser.newContext()
  await signIn(other, "beto@example.com")
  const page = await other.newPage()
  const ana = await prisma.user.findUniqueOrThrow({ where: { email: "ana@example.com" } })
  const locker = await prisma.locker.findFirstOrThrow({ where: { userId: ana.id } })
  await page.goto(`/dashboard/lockers/${locker.id}`)
  await expect(page.getByText("This page could not be found")).toBeVisible()
})
```

Also add a guest-disclosure test: open a valid share page and assert the HTML does not contain the owner email, `vendorLockId`, gateway id, or another locker name. Add a headers test that repeats the Task 17 assertions.

Seed `beto@example.com` with a confirmed locker in `e2e/global-setup.ts`; do not weaken the production allowlist.

- [ ] **Step 3: Run the security spec to verify it fails**

Run: `pnpm test:e2e e2e/security.spec.ts`
Expected: FAIL for the missing helper, seed, or assertion until the fixtures and any missing behavior are fixed. A failure caused by a real app bug is a finding; fix the owning task before making the test pass.

- [ ] **Step 4: Make the security spec pass**

Fix the app or the fixture, not the assertion, unless the assertion is wrong. Do not weaken the generic unavailable copy or the cross-user 404. Re-run until the spec passes.

- [ ] **Step 5: Write the accessibility spec**

Create `e2e/accessibility.spec.ts`:

```ts
import AxeBuilder from "@axe-core/playwright"

async function expectNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  const serious = results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
}

test("key pages have no serious axe violations", async ({ page, context }) => {
  await page.goto("/auth")
  await expectNoSeriousViolations(page)
  await signIn(context)
  for (const path of ["/dashboard", "/dashboard/settings", "/dashboard/activity"]) {
    await page.goto(path)
    await expectNoSeriousViolations(page)
  }
})

test("theme radios and dialogs work from the keyboard", async ({ page, context }) => {
  await signIn(context)
  await page.goto("/dashboard/settings")
  await page.getByRole("radio", { name: /^Dark/ }).focus()
  await page.keyboard.press("ArrowDown")
  await expect(page.getByRole("radio", { name: /^System/ })).toBeChecked()
  await page.keyboard.press("Escape")
})
```

Add a guest-page axe check with a valid share token, and a share-dialog focus test: open the dialog, press Tab through the controls, press Escape, and assert focus returns to the trigger. If the existing radio accessible name includes the description, match with a prefix as above rather than changing the Task 14 ruling.

- [ ] **Step 6: Run the accessibility spec and fix findings**

Run: `pnpm test:e2e e2e/accessibility.spec.ts`
Expected: PASS after fixing any serious/critical violations in the owning component. Re-run the whole E2E suite to confirm the fixes did not regress another flow.

- [ ] **Step 7: Update the docs**

- `README.md`: add the security and accessibility E2E coverage to the test section.
- `docs/pilot-setup-guide.md`: add a pre-invite check that the security and accessibility specs pass and that `beto@example.com` exists only in the test seed.

- [ ] **Step 8: Run the full verification**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`
Expected: lint clean, typecheck clean, all tests pass, build passes, and every E2E test passes.

- [ ] **Step 9: Commit**

```bash
git add e2e package.json pnpm-lock.yaml README.md docs/pilot-setup-guide.md
git commit -m "test: cover security and accessibility journeys"
```
