import { expect, test } from "@playwright/test"

test("the privacy notice is reachable and names the contact", async ({ page }) => {
  await page.goto("/auth")
  await page.getByRole("link", { name: "Privacy notice" }).click()

  await expect(page).toHaveURL(/\/privacy$/)
  await expect(page.getByRole("heading", { name: "Privacy notice" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "How long we keep it" })).toBeVisible()
  await expect(page.getByRole("link", { name: "privacy@example.com" })).toBeVisible()
})
