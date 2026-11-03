import { expect, test } from "@playwright/test"

test("appearance follows the settings choice and the device preference", async ({ browser }) => {
  const owner = await browser.newContext()
  const page = await owner.newPage()

  try {
    const sessionResponse = await owner.request.post("/api/test/session", {
      data: { email: "ana@example.com" },
    })
    expect(sessionResponse.status()).toBe(200)

    await page.goto("/dashboard/settings")
    await expect(page.getByText("Appearance", { exact: true })).toBeVisible()

    await page.getByRole("radio", { name: "Dark" }).click()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await expect(page.locator("html")).toHaveCSS("color-scheme", "dark")

    await page.reload()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked()

    await page.getByRole("radio", { name: "Light" }).click()
    await expect(page.locator("html")).not.toHaveClass(/dark/)

    await page.getByRole("radio", { name: "System" }).click()
    await expect(page.locator("html")).not.toHaveClass(/dark/)
  } finally {
    await owner.close()
  }

  const darkContext = await browser.newContext({ colorScheme: "dark" })
  const darkPage = await darkContext.newPage()

  try {
    await darkPage.goto("/auth")
    await expect(darkPage.locator("html")).toHaveClass(/dark/)
    await expect(darkPage.locator("html")).toHaveCSS("color-scheme", "dark")

    await darkPage.goto("/share/not-a-real-token")
    await expect(darkPage.getByText("no longer available")).toBeVisible()
    await expect(darkPage.locator("html")).toHaveClass(/dark/)
  } finally {
    await darkContext.close()
  }
})
