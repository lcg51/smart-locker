import { expect, test } from "@playwright/test"

test("successful form and settings actions use toast notifications", async ({ page, context }) => {
  await context.request.post("/api/test/session", { data: { email: "toast@example.com" } })

  await page.goto("/onboarding")
  await page.getByLabel("Locker name").fill("Kitchenette")
  await page.getByRole("button", { name: "Save name" }).click()
  await expect(page.getByText("Locker name saved.", { exact: true })).toBeVisible()

  await page.goto("/dashboard/settings")
  await page.getByLabel("Display name").fill("Toast Tester")
  await page.getByRole("button", { name: "Save name" }).click()
  await expect(page.getByText("Display name updated.", { exact: true })).toBeVisible()

  await page.getByRole("switch", { name: "Guest unlock emails" }).click()
  await expect(page.getByText("Preference saved.", { exact: true })).toBeVisible()
})

test("device PIN changes use toast notifications", async ({ page, context }) => {
  await context.request.post("/api/test/session", { data: { email: "toast@example.com" } })
  await page.goto("/dashboard/settings")

  await page.getByRole("button", { name: "Set a device PIN" }).click()
  for (let i = 0; i < 4; i += 1) await page.getByRole("button", { name: "1", exact: true }).click()
  for (let i = 0; i < 4; i += 1) await page.getByRole("button", { name: "1", exact: true }).click()
  await expect(page.getByText("PIN set for this device.", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Remove PIN" }).click()
  await expect(page.getByText("Device PIN removed.", { exact: true })).toBeVisible()
})
