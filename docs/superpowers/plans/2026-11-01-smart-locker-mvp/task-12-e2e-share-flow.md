# Task 12: End-to-end share flow and test session route

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Smart Locker MVP — Design](../../specs/2026-11-01-smart-locker-mvp-design.md).
> Phase 1 (mock provider). **Depends on:** Task 04, Task 05, Task 06, Task 07, Task 10.

---

**Files:**
- Create: `app/api/test/session/route.ts`, `playwright.config.ts`, `e2e/global-setup.ts`, `e2e/share-flow.spec.ts`
- Modify: `.env.test.example` (ensure `E2E=1`)

**Interfaces:**
- Consumes: `prisma`, `provisionApartment`, all UI routes.
- Produces: a test-only `POST /api/test/session` that returns 404 unless `E2E=1`.

- [ ] **Step 1: Write the failing end-to-end test**

Create `e2e/share-flow.spec.ts`:

```ts
import { expect, test } from "@playwright/test"

test("owner shares a locker, guest unlocks, owner revokes", async ({ browser }) => {
  const owner = await browser.newContext()
  const page = await owner.newPage()
  await owner.request.post("/api/test/session", { data: { email: "ana@example.com" } })

  await page.goto("/onboarding")
  await page.getByRole("button", { name: "Confirm" }).click()
  await expect(page).toHaveURL(/\/dashboard/)

  await page.goto("/dashboard")
  await expect(page.getByRole("heading", { name: "Your lockers" })).toBeVisible()
  await page.getByRole("button", { name: "Unlock Kitchen" }).click()
  await expect(page.getByText("unlocked", { exact: false })).toBeVisible()

  await page.getByRole("link", { name: "Kitchen" }).click()
  await page.getByRole("button", { name: "Share access" }).click()
  await page.getByLabel("Guest label").fill("Ana")
  await page.getByRole("button", { name: "Create link" }).click()
  const shareUrl = await page.getByTestId("share-url").inputValue()
  expect(shareUrl).toContain("/share/")

  const guest = await browser.newContext()
  const guestPage = await guest.newPage()
  await guestPage.goto(shareUrl)
  await expect(guestPage.getByText("ana@example.com")).toHaveCount(0)
  await expect(guestPage.getByText("gw-e2e")).toHaveCount(0)
  await guestPage.getByRole("button", { name: "Unlock" }).click()
  await expect(guestPage.getByText("re-lock automatically", { exact: false })).toBeVisible()

  await page.getByRole("button", { name: "Revoke" }).click()
  await guestPage.reload()
  await expect(guestPage.getByText("no longer available")).toBeVisible()
})
```

The dashboard redirects unconfirmed residents to `/onboarding` (Task 10), so the flow confirms the provisioned locker before asserting the dashboard.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:e2e e2e/share-flow.spec.ts`
Expected: FAIL because the test session route and Playwright config do not exist.

- [ ] **Step 3: Add the test-only session route**

Create `app/api/test/session/route.ts`. Return 404 when `getEnv().E2E !== "1"`. Otherwise read `{ email }`, find the user, create a `Session` row with a random 32-byte hex token expiring in 30 days, set the `authjs.session-token` cookie (httpOnly, sameSite lax, path `/`, same expiry), and return `{ ok: true }`. Unknown users return 404.

- [ ] **Step 4: Add Playwright configuration and seeding**

Create `playwright.config.ts` with `testDir: "./e2e"`, `baseURL: "http://localhost:3000"`, `globalSetup: "./e2e/global-setup.ts"`, and a `webServer` running `dotenv -e .env.test -- pnpm dev` on port 3000 with `reuseExistingServer: !process.env.CI`.

Create `e2e/global-setup.ts`: run `dotenv -e .env.test -- pnpm prisma migrate reset --force --skip-seed`, then call `provisionApartment` with `ana@example.com`, gateway `gw-e2e`, and one locker named `Kitchen` with vendor `mock` and vendorLockId `e2e-lock-1`. Import it with a relative path (`../lib/ops/provision`) because Playwright does not read the Next.js `@` alias.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test:e2e e2e/share-flow.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/test playwright.config.ts e2e .env.test.example
git commit -m "test: add end-to-end share flow"
```
