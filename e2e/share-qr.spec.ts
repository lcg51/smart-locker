import { expect, test } from "@playwright/test"

test("a created share link can be shared through the OS and shown as a QR code", async ({ page, context }) => {
  const session = await context.request.post("/api/test/session", {
    data: { email: "ana@example.com" },
  })
  expect(session.status()).toBe(200)

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        ;(window as unknown as { __shared: ShareData }).__shared = data
      },
    })
  })

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

  const url = await page.getByTestId("share-url").inputValue()
  await page.getByRole("button", { name: "Share…" }).click()
  await expect.poll(() => page.evaluate(
    () => (window as unknown as { __shared?: ShareData }).__shared?.url,
  )).toBe(url)

  await page.getByRole("button", { name: "Show QR code" }).click()
  await expect(page.getByRole("img", { name: "QR code for the share link" })).toBeVisible()

  await page.getByRole("button", { name: "Hide QR code" }).click()
  await expect(page.getByRole("img", { name: "QR code for the share link" })).toHaveCount(0)
})
