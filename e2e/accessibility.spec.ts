import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"
import { createShareForSeed, removeSeededShares, signIn } from "./helpers"

test.afterEach(removeSeededShares)

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

test("the guest share page has no serious axe violations", async ({ page }) => {
  const { token } = await createShareForSeed({ durationMinutes: 60 })
  await page.goto(`/share/${token}`)
  await expect(page.getByRole("button", { name: "Unlock locker" })).toBeVisible()
  await expectNoSeriousViolations(page)
})

test("theme radios and dialogs work from the keyboard", async ({ page, context }) => {
  await signIn(context)
  await page.goto("/dashboard/settings")
  await page.getByRole("radio", { name: /^Dark/ }).focus()
  await page.keyboard.press("ArrowDown")
  await expect(page.getByRole("radio", { name: /^System/ })).toBeChecked()
  await page.keyboard.press("Escape")
})

test("the share dialog returns focus to its trigger on close", async ({ page, context }) => {
  await signIn(context, "beto@example.com")
  await page.goto("/dashboard")

  await page.getByRole("link", { name: "Locker details" }).click()
  const trigger = page.getByRole("button", { name: "Share access" })
  await trigger.click()
  await expect(page.getByRole("button", { name: "Close share dialog" })).toBeVisible()

  await page.keyboard.press("Tab")
  const focusInsideDialog = await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))
  expect(focusInsideDialog).toBe(true)
  await page.keyboard.press("Escape")

  await expect(page.getByRole("dialog")).toBeHidden()
  await expect(trigger).toBeFocused()
})
