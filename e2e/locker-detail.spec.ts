import { expect, test } from "@playwright/test"

test("the locker detail page shows controls and recent activity", async ({ page, context }) => {
  const session = await context.request.post("/api/test/session", {
    data: { email: "ana@example.com" },
  })
  expect(session.status()).toBe(200)

  await page.goto("/onboarding")
  await page.getByRole("button", { name: "Confirm this locker" }).click()
  await expect(page).toHaveURL(/\/dashboard/)

  await page.getByRole("link", { name: "Locker details" }).click()

  await expect(page.getByRole("heading", { name: "Controls" })).toBeVisible()
  await expect(page.getByText(/Last checked|Not checked yet/)).toBeVisible()
  await expect(page.getByRole("link", { name: "View all activity" })).toBeVisible()

  await page.getByRole("button", { name: "Unlock" }).click()
  await expect(page.getByText("Unlocked", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("Resident")).toBeVisible()
  await expect(page.getByText("Succeeded")).toBeVisible()

  await page.getByRole("button", { name: "Lock" }).click()
  await expect(page.getByText("Locked", { exact: true }).first()).toBeVisible()
})
