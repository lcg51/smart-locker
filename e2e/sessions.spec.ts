import { expect, test } from "@playwright/test"

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

test("a resident can revoke another browser session", async ({ browser }) => {
  const first = await browser.newContext({
    userAgent: IPHONE_SAFARI,
    extraHTTPHeaders: {
      "x-vercel-ip-city": "Madrid",
      "x-vercel-ip-country": "ES",
    },
  })
  const second = await browser.newContext()

  try {
    await first.request.post("/api/test/session", { data: { email: "ana@example.com" } })
    await second.request.post("/api/test/session", { data: { email: "ana@example.com" } })

    const page = await first.newPage()
    await page.goto("/dashboard/settings")

    await expect(page.getByText("This device", { exact: true })).toBeVisible()
    await expect(page.getByText("Safari on iOS", { exact: true })).toBeVisible()
    await expect(page.getByText("Approximate location: Madrid, ES", { exact: true })).toBeVisible()
    await expect(page.getByText("Another device", { exact: true }).first()).toBeVisible()

    await page.getByRole("button", { name: "Revoke other sessions" }).click()
    await page.getByRole("button", { name: "Revoke other sessions", exact: true }).last().click()
    await expect(page.getByText("Other sessions revoked.")).toBeVisible()

    const otherPage = await second.newPage()
    await otherPage.goto("/dashboard")
    await expect(otherPage).toHaveURL(/\/auth/)
  } finally {
    await first.close()
    await second.close()
  }
})
