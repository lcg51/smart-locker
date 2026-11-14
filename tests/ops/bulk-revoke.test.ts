import { beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { bulkRevokeGrants } from "@/lib/ops/bulk-revoke"
import { provisionApartment } from "@/lib/ops/provision"
import { createShareGrant, revokeShareGrant } from "@/lib/shares/service"
import { resetDb } from "@/tests/helpers/db"

beforeEach(resetDb)

async function seedResident(email: string, gatewayId: string, vendorLockId: string) {
  const { userId } = await provisionApartment({
    email,
    gatewayId,
    lockers: [{ name: "Kitchen", vendor: "mock", vendorLockId }],
  })
  const locker = await prisma.locker.findFirstOrThrow({ where: { userId } })
  return { userId, lockerId: locker.id }
}

async function seedLiveGrants(userId: string, lockerId: string, count: number) {
  for (let i = 0; i < count; i += 1) {
    await createShareGrant({ userId, lockerId })
  }
}

describe("bulkRevokeGrants", () => {
  it("revokes only the requested resident's live grants", async () => {
    const ana = await seedResident("ana@example.com", "gw-ana", "ana-lock")
    const beto = await seedResident("beto@example.com", "gw-beto", "beto-lock")
    await seedLiveGrants(ana.userId, ana.lockerId, 2)
    await seedLiveGrants(beto.userId, beto.lockerId, 2)

    const alreadyRevoked = await createShareGrant({ userId: ana.userId, lockerId: ana.lockerId })
    await revokeShareGrant({ userId: ana.userId, grantId: alreadyRevoked.grant.id })

    const now = new Date("2026-11-14T10:00:00.000Z")
    await expect(bulkRevokeGrants({ email: " Ana@Example.com ", now })).resolves.toEqual({ revoked: 2 })

    expect(await prisma.shareGrant.count({
      where: { createdByUserId: ana.userId, revokedAt: null },
    })).toBe(0)
    expect(await prisma.shareGrant.count({
      where: { createdByUserId: beto.userId, revokedAt: null },
    })).toBe(2)
  })

  it("revokes every live grant with --all", async () => {
    const ana = await seedResident("ana@example.com", "gw-ana", "ana-lock")
    const beto = await seedResident("beto@example.com", "gw-beto", "beto-lock")
    await seedLiveGrants(ana.userId, ana.lockerId, 2)
    await seedLiveGrants(beto.userId, beto.lockerId, 1)

    await expect(bulkRevokeGrants({ all: true })).resolves.toEqual({ revoked: 3 })
    expect(await prisma.shareGrant.count({ where: { revokedAt: null } })).toBe(0)
  })

  it("returns zero for an unknown email", async () => {
    await expect(bulkRevokeGrants({ email: "missing@example.com" })).resolves.toEqual({ revoked: 0 })
  })

  it("requires exactly one of all or email", async () => {
    await expect(bulkRevokeGrants({})).rejects.toThrow("exactly_one_of_all_or_email")
    await expect(bulkRevokeGrants({ all: true, email: "ana@example.com" }))
      .rejects.toThrow("exactly_one_of_all_or_email")
  })
})
