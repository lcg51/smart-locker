import { beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { provisionApartment } from "@/lib/ops/provision"
import { resolveRelockState } from "@/lib/shares/redeem"
import { createShareGrant } from "@/lib/shares/service"
import { resetDb } from "@/tests/helpers/db"

beforeEach(resetDb)

async function seed() {
  const { userId } = await provisionApartment({
    email: "relock-state@example.com",
    gatewayId: "gw-relock-state",
    lockers: [{ name: "Kitchen", vendor: "mock", vendorLockId: "relock-state-lock" }],
  })
  const locker = await prisma.locker.findFirstOrThrow({ where: { userId } })
  return { userId, locker }
}

describe("resolveRelockState", () => {
  it("returns the pending deadline even when the grant can no longer be redeemed", async () => {
    const { userId, locker } = await seed()
    const { token, grant } = await createShareGrant({ userId, lockerId: locker.id, maxUses: 1 })
    const relockAt = new Date(Date.now() + 30_000)
    await prisma.locker.update({ where: { id: locker.id }, data: { relockAt } })
    await prisma.shareGrant.update({ where: { id: grant.id }, data: { usedCount: 1 } })

    await expect(resolveRelockState(token)).resolves.toEqual({ relockAt })
  })

  it("returns the pending deadline for expired and revoked grants", async () => {
    const { userId, locker } = await seed()
    const { token, grant } = await createShareGrant({ userId, lockerId: locker.id })
    const relockAt = new Date(Date.now() + 30_000)
    await prisma.locker.update({ where: { id: locker.id }, data: { relockAt } })

    await prisma.shareGrant.update({ where: { id: grant.id }, data: { expiresAt: new Date(Date.now() - 1) } })
    await expect(resolveRelockState(token)).resolves.toEqual({ relockAt })

    await prisma.shareGrant.update({
      where: { id: grant.id },
      data: { expiresAt: new Date(Date.now() + 60_000), revokedAt: new Date() },
    })
    await expect(resolveRelockState(token)).resolves.toEqual({ relockAt })
  })

  it("returns null when nothing is pending or the token is unknown", async () => {
    const { userId, locker } = await seed()
    const { token } = await createShareGrant({ userId, lockerId: locker.id })

    await expect(resolveRelockState(token)).resolves.toEqual({ relockAt: null })
    await expect(resolveRelockState("unknown")).resolves.toEqual({ relockAt: null })
  })
})
