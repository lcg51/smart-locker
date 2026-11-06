import { expect, test } from "@playwright/test"
import { prisma } from "../lib/db"
import { createShareGrant } from "../lib/shares/service"
import { hashShareToken } from "../lib/shares/token"

test("a reloaded one-use link shows the pending relock and cannot unlock", async ({ page }) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: "ana@example.com" } })
  const locker = await prisma.locker.findFirstOrThrow({ where: { userId: user.id } })
  const { token } = await createShareGrant({
    userId: user.id,
    lockerId: locker.id,
    guestLabel: "Cleaner",
    maxUses: 1,
  })
  const tokenHash = hashShareToken(token)

  try {
    await prisma.locker.update({
      where: { id: locker.id },
      data: { relockAt: new Date(Date.now() + 60_000) },
    })
    await prisma.shareGrant.update({ where: { tokenHash }, data: { usedCount: 1 } })

    await page.goto(`/share/${token}`)

    await expect(page.getByText("This link is no longer available")).toBeVisible()
    await expect(page.getByText("Relocking locker")).toBeVisible()
    await expect(page.getByText("It will relock automatically")).toBeVisible()
    await expect(page.getByRole("button", { name: "Unlock locker" })).toHaveCount(0)
  } finally {
    await prisma.locker.update({ where: { id: locker.id }, data: { relockAt: null } })
    await prisma.shareGrant.deleteMany({ where: { tokenHash } })
  }
})

test("the cron fallback relocks a due locker after the guest tab is gone", async ({ request }) => {
  const secret = process.env.CRON_SECRET
  expect(secret).toBeTruthy()

  const user = await prisma.user.findUniqueOrThrow({ where: { email: "ana@example.com" } })
  const locker = await prisma.locker.findFirstOrThrow({ where: { userId: user.id } })

  try {
    await prisma.locker.update({
      where: { id: locker.id },
      data: { relockAt: new Date(Date.now() - 1_000), status: "UNLOCKED" },
    })

    const response = await request.get("/api/cron/relock", {
      headers: { authorization: `Bearer ${secret}` },
    })

    expect(response.status()).toBe(200)
    const body = await response.json() as { relocked: number; failed: number }
    expect(body.relocked).toBeGreaterThanOrEqual(1)
    expect(body.failed).toBe(0)

    const saved = await prisma.locker.findUniqueOrThrow({ where: { id: locker.id } })
    expect(saved.relockAt).toBeNull()
    expect(saved.status).toBe("LOCKED")
  } finally {
    await prisma.locker.update({ where: { id: locker.id }, data: { relockAt: null } })
  }
})
