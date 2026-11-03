import { expect, test, type Locator } from "@playwright/test"

async function contrastRatio(locator: Locator): Promise<number> {
  return locator.evaluate((element) => {
    type Rgba = { r: number; g: number; b: number; a: number }

    const clamp = (channel: number) => Math.max(0, Math.min(1, channel))
    const toLinear = (channel: number) => {
      const value = channel / 255
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    }

    const oklabToRgb = (l: number, a: number, b: number) => {
      const l_ = l + 0.3963377774 * a + 0.2158037573 * b
      const m_ = l - 0.1055613458 * a - 0.0638541728 * b
      const s_ = l - 0.0894841775 * a - 1.291485548 * b
      const l3 = l_ ** 3
      const m3 = m_ ** 3
      const s3 = s_ ** 3
      return {
        r: clamp(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3),
        g: clamp(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3),
        b: clamp(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3),
      }
    }

    const labToRgb = (l: number, a: number, b: number) => {
      const kappa = 24389 / 27
      const epsilon = 216 / 24389
      const fy = (l + 16) / 116
      const fx = a / 500 + fy
      const fz = fy - b / 200
      const xr = fx ** 3 > epsilon ? fx ** 3 : (116 * fx - 16) / kappa
      const yr = l > kappa * epsilon ? ((l + 16) / 116) ** 3 : l / kappa
      const zr = fz ** 3 > epsilon ? fz ** 3 : (116 * fz - 16) / kappa
      const x = xr * 0.96422
      const y = yr
      const z = zr * 0.82521
      return {
        r: clamp(3.1338561 * x - 1.6168667 * y - 0.4906146 * z),
        g: clamp(-0.9787684 * x + 1.9161415 * y + 0.033454 * z),
        b: clamp(0.0719453 * x - 0.2289914 * y + 1.4052427 * z),
      }
    }

    const withAlpha = (color: { r: number; g: number; b: number }, alphaPart?: string): Rgba => ({
      ...color,
      a: alphaPart ? Number(alphaPart) : 1,
    })

    const parse = (value: string): Rgba => {
      if (value === "transparent") return { r: 0, g: 0, b: 0, a: 0 }

      const oklch = value.match(/^oklch\(([^)]+)\)$/)
      if (oklch) {
        const [main, alphaPart] = oklch[1].split("/")
        const [l, c, h] = main.trim().split(/\s+/).map(Number)
        const radians = (h * Math.PI) / 180
        return withAlpha(oklabToRgb(l, c * Math.cos(radians), c * Math.sin(radians)), alphaPart)
      }

      const oklab = value.match(/^oklab\(([^)]+)\)$/)
      if (oklab) {
        const [main, alphaPart] = oklab[1].split("/")
        const [l, a, b] = main.trim().split(/\s+/).map(Number)
        return withAlpha(oklabToRgb(l, a, b), alphaPart)
      }

      const lab = value.match(/^lab\(([^)]+)\)$/)
      if (lab) {
        const [main, alphaPart] = lab[1].split("/")
        const [l, a, b] = main.trim().split(/\s+/).map(Number)
        return withAlpha(labToRgb(l, a, b), alphaPart)
      }

      const srgb = value.match(/^color\(srgb\s+([^)]+)\)$/)
      if (srgb) {
        const parts = srgb[1].split(/[\s,/]+/).filter(Boolean).map(Number)
        return {
          r: toLinear(parts[0] * 255),
          g: toLinear(parts[1] * 255),
          b: toLinear(parts[2] * 255),
          a: parts[3] ?? 1,
        }
      }

      const rgb = value.match(/^rgba?\(([^)]+)\)$/)
      if (!rgb) throw new Error(`Unsupported color: ${value}`)
      const parts = rgb[1].split(/[\s,/]+/).filter(Boolean).map(Number)
      return {
        r: toLinear(parts[0]),
        g: toLinear(parts[1]),
        b: toLinear(parts[2]),
        a: parts[3] ?? 1,
      }
    }

    const composite = (foreground: Rgba, background: Rgba): Rgba => ({
      r: foreground.r * foreground.a + background.r * (1 - foreground.a),
      g: foreground.g * foreground.a + background.g * (1 - foreground.a),
      b: foreground.b * foreground.a + background.b * (1 - foreground.a),
      a: foreground.a + background.a * (1 - foreground.a),
    })

    const effectiveBackground = (start: Element): Rgba => {
      let node: Element | null = start
      let result: Rgba = { r: 0, g: 0, b: 0, a: 0 }
      while (node) {
        const layer = parse(getComputedStyle(node).backgroundColor)
        if (layer.a > 0) {
          result = composite(layer, result)
          if (result.a >= 1) break
        }
        node = node.parentElement
      }
      return result
    }

    const luminance = (color: Rgba) => 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b
    const foreground = parse(getComputedStyle(element).color)
    const background = effectiveBackground(element)
    const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
    return (lighter + 0.05) / (darker + 0.05)
  })
}

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

test("destructive text and actions stay legible in both themes", async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    const sessionResponse = await context.request.post("/api/test/session", {
      data: { email: "ana@example.com" },
    })
    expect(sessionResponse.status()).toBe(200)

    for (const theme of ["Light", "Dark"] as const) {
      await page.goto("/dashboard/settings")
      await page.getByRole("radio", { name: theme }).click()

      const dangerHeading = page.getByText("Danger zone", { exact: true })
      await expect(dangerHeading).toBeVisible()
      expect(await contrastRatio(dangerHeading)).toBeGreaterThanOrEqual(4.5)

      await page.getByRole("button", { name: "Delete account", exact: true }).click()
      const confirmDelete = page.getByRole("button", { name: "Delete account permanently" })
      await expect(confirmDelete).toBeVisible()
      expect(await contrastRatio(confirmDelete)).toBeGreaterThanOrEqual(4.5)
      await page.getByRole("button", { name: "Keep my account" }).click()
    }
  } finally {
    await context.close()
  }
})
