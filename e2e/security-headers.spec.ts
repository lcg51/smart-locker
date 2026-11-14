import { expect, test } from "@playwright/test"

test("guest and private pages send privacy and security headers", async ({ context, page }) => {
  const share = await context.request.get("/share/not-a-real-token")

  expect(share.status()).toBe(200)
  expect(share.headers()["x-robots-tag"]).toContain("noindex")
  expect(share.headers()["cache-control"]).toContain("no-store")
  expect(share.headers()["referrer-policy"]).toBe("no-referrer")
  expect(share.headers()["x-frame-options"]).toBe("DENY")
  expect(share.headers()["x-content-type-options"]).toBe("nosniff")
  expect(share.headers()["permissions-policy"]).toContain("camera=()")
  expect(share.headers()["content-security-policy"]).toContain("frame-ancestors 'none'")
  expect(share.headers()["content-security-policy"]).toContain("base-uri 'self'")

  await page.goto("/share/not-a-real-token")
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/)

  const auth = await context.request.get("/auth")
  expect(auth.status()).toBe(200)
  expect(auth.headers()["x-robots-tag"]).toContain("noindex")
  expect(auth.headers()["cache-control"]).toContain("no-store")

  const session = await context.request.post("/api/test/session", {
    data: { email: "ana@example.com" },
  })
  expect(session.status()).toBe(200)

  const dashboard = await context.request.get("/dashboard")
  expect(dashboard.status()).toBe(200)
  expect(dashboard.headers()["x-robots-tag"]).toContain("noindex")
  expect(dashboard.headers()["cache-control"]).toContain("no-store")
})
