import { expect, test } from "@playwright/test"
import { prisma } from "../lib/db"
import { hashShareToken } from "../lib/shares/token"
import { createShareForSeed, removeSeededShares, signIn } from "./helpers"

test.afterEach(removeSeededShares)

test("an expired link fails closed with the generic page", async ({ page }) => {
  const { token } = await createShareForSeed({ durationMinutes: 15 })
  await prisma.shareGrant.update({
    where: { tokenHash: hashShareToken(token) },
    data: { expiresAt: new Date(Date.now() - 1_000) },
  })

  await page.goto(`/share/${token}`)
  await expect(page.getByRole("heading", { name: "This link is no longer available" })).toBeVisible()
})

test("a revoked link fails closed", async ({ page }) => {
  const { token, grant } = await createShareForSeed({ durationMinutes: 60 })
  await prisma.shareGrant.update({ where: { id: grant.id }, data: { revokedAt: new Date() } })

  await page.goto(`/share/${token}`)
  await expect(page.getByRole("heading", { name: "This link is no longer available" })).toBeVisible()
})

test("a one-use link cannot be replayed", async ({ page }) => {
  const { token } = await createShareForSeed({ durationMinutes: 60, maxUses: 1 })

  await page.goto(`/share/${token}`)
  await page.getByRole("button", { name: "Unlock locker" }).click()
  await expect(page.getByText("Locker unlocked")).toBeVisible()

  await page.reload()
  await expect(page.getByRole("heading", { name: "This link is no longer available" })).toBeVisible()
})

test("a resident cannot open another resident's locker", async ({ browser }) => {
  const other = await browser.newContext()
  try {
    await signIn(other, "beto@example.com")
    const page = await other.newPage()
    const ana = await prisma.user.findUniqueOrThrow({ where: { email: "ana@example.com" } })
    const locker = await prisma.locker.findFirstOrThrow({ where: { userId: ana.id } })

    await page.goto(`/dashboard/lockers/${locker.id}`)
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible()
  } finally {
    await other.close()
  }
})

test("a valid guest page does not disclose owner or vendor details", async ({ page }) => {
  const { token } = await createShareForSeed({ durationMinutes: 60 })

  const response = await page.goto(`/share/${token}`)
  expect(response?.status()).toBe(200)
  await expect(page.getByRole("button", { name: "Unlock locker" })).toBeVisible()

  const html = await page.content()
  for (const secret of ["ana@example.com", "beto@example.com", "e2e-lock-1", "gw-e2e", "beto-lock-1", "Balcony", "Toast locker"]) {
    expect(html).not.toContain(secret)
  }
})

test("a valid guest page sends privacy and security headers", async ({ context }) => {
  const { token } = await createShareForSeed({ durationMinutes: 60 })

  const response = await context.request.get(`/share/${token}`)
  expect(response.status()).toBe(200)
  expect(response.headers()["x-robots-tag"]).toContain("noindex")
  expect(response.headers()["cache-control"]).toContain("no-store")
  expect(response.headers()["referrer-policy"]).toBe("no-referrer")
  expect(response.headers()["x-frame-options"]).toBe("DENY")
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'")
})
