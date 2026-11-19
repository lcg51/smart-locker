import { expect, test } from "@playwright/test"

test("an owner can extend a live share link", async ({ page, context }) => {
  const session = await context.request.post("/api/test/session", {
    data: { email: "ana@example.com" },
  })
  expect(session.status()).toBe(200)

  await page.goto("/onboarding")
  const confirmLocker = page.getByRole("button", { name: "Confirm this locker" })
  if (await confirmLocker.count() > 0) {
    await confirmLocker.click()
  }
  await expect(page).toHaveURL(/\/dashboard/)

  await page.getByRole("link", { name: "Locker details" }).click()
  await page.getByRole("button", { name: "Share access" }).click()
  await page.getByLabel("Guest label").fill("Cleaner")
  await page.getByRole("button", { name: "Create share link" }).click()
  await page.getByRole("button", { name: "Close share dialog" }).click()

  await page.getByRole("button", { name: "Extend" }).click()
  await page.getByLabel("Additional minutes").fill("30")
  await page.getByLabel("Additional unlocks").fill("2")
  await page.getByRole("button", { name: "Extend link" }).click()

  await expect(page.getByText("Share link extended.", { exact: true })).toBeVisible()
  await expect(page.getByRole("main").getByText("0 of 7 unlocks used")).toBeVisible()
  await expect(page.getByText("Extended", { exact: true })).toBeVisible()
  await expect(page.getByText("+30 minutes, +2 uses")).toBeVisible()

  await page.getByRole("main").getByRole("button", { name: "Revoke", exact: true }).click()
  await page.getByRole("button", { name: "Revoke link" }).click()
  await expect(page.getByText("No active share links.")).toBeVisible()
})
