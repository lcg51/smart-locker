import { expect, test } from "@playwright/test"

test("the app loads and applies its sans-serif font", async ({ page }) => {
  await page.goto("/auth")
  await page.evaluate(() => document.fonts.ready)

  const result = await page.evaluate(() => {
    const variable = getComputedStyle(document.documentElement)
      .getPropertyValue("--font-geist-sans")
      .trim()
    const fontFamily = getComputedStyle(document.body).fontFamily
    const primary = fontFamily.split(",")[0]?.replace(/["']/g, "").trim() ?? ""
    const loaded = [...document.fonts].some(
      (face) => face.family.replace(/["']/g, "") === primary && face.status === "loaded",
    )
    return { variable, fontFamily, loaded }
  })

  expect(result.variable).not.toBe("")
  expect(result.fontFamily).toContain("sans-serif")
  expect(result.loaded).toBe(true)
})
