import { beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { provisionApartment } from "@/lib/ops/provision"
import { createShareGrant, listActiveGrants, revokeShareGrant } from "@/lib/shares/service"
import { hashShareToken } from "@/lib/shares/token"
import { resetDb } from "@/tests/helpers/db"

beforeEach(resetDb)

async function seed() {
  const { userId } = await provisionApartment({
    email: "ana@example.com",
    gatewayId: "gw-1",
    lockers: [{ name: "Kitchen", vendor: "mock", vendorLockId: "lock-1" }],
  })
  const locker = await prisma.locker.findFirstOrThrow({ where: { userId } })
  return { userId, locker }
}

describe("createShareGrant", () => {
  it("stores only the hash and applies the defaults", async () => {
    const { userId, locker } = await seed()
    const { token, grant } = await createShareGrant({ userId, lockerId: locker.id })

    expect(grant.tokenHash).toBe(hashShareToken(token))
    expect(grant.tokenHash).not.toBe(token)
    expect(grant.maxUses).toBe(5)
    expect(grant.expiresAt.getTime() - grant.createdAt.getTime()).toBeGreaterThanOrEqual(3_599_000)
  })

  it("rejects durations outside 15 minutes through 24 hours and invalid use counts", async () => {
    const { userId, locker } = await seed()

    await expect(createShareGrant({ userId, lockerId: locker.id, durationMinutes: 14 })).rejects.toThrow("invalid_duration")
    await expect(createShareGrant({ userId, lockerId: locker.id, durationMinutes: 1441 })).rejects.toThrow("invalid_duration")
    await expect(createShareGrant({ userId, lockerId: locker.id, maxUses: 0 })).rejects.toThrow("invalid_max_uses")
    await expect(createShareGrant({ userId, lockerId: locker.id, maxUses: 51 })).rejects.toThrow("invalid_max_uses")
  })

  it("does not let another resident create or revoke a grant", async () => {
    const { userId, locker } = await seed()
    const { grant } = await createShareGrant({ userId, lockerId: locker.id })
    const stranger = await prisma.user.create({ data: { email: "stranger@example.com" } })

    await expect(createShareGrant({ userId: stranger.id, lockerId: locker.id })).rejects.toThrow("locker_not_found")
    await expect(revokeShareGrant({ userId: stranger.id, grantId: grant.id })).resolves.toBe(false)
  })

  it("rejects lockers that are not owned or are soft-deleted", async () => {
    const { userId, locker } = await seed()
    const other = await prisma.user.create({ data: { email: "other@example.com" } })

    await expect(createShareGrant({ userId: other.id, lockerId: locker.id })).rejects.toThrow("locker_not_found")
    await prisma.locker.update({ where: { id: locker.id }, data: { deletedAt: new Date() } })
    await expect(createShareGrant({ userId, lockerId: locker.id })).rejects.toThrow("locker_not_found")
  })
})

describe("share grants", () => {
  it("revokes a grant once and hides it from the active list", async () => {
    const { userId, locker } = await seed()
    const { grant } = await createShareGrant({ userId, lockerId: locker.id })

    await expect(revokeShareGrant({ userId, grantId: grant.id })).resolves.toBe(true)
    await expect(revokeShareGrant({ userId, grantId: grant.id })).resolves.toBe(false)
    await expect(listActiveGrants({ userId, lockerId: locker.id })).resolves.toEqual([])
  })

  it("lists only active grants for the owner and locker, newest first", async () => {
    const { userId, locker } = await seed()
    const first = await createShareGrant({ userId, lockerId: locker.id })
    const second = await createShareGrant({ userId, lockerId: locker.id })
    const third = await createShareGrant({ userId, lockerId: locker.id })
    await prisma.shareGrant.update({
      where: { id: first.grant.id },
      data: { createdAt: new Date("2025-01-01T00:00:00.000Z") },
    })
    await prisma.shareGrant.update({
      where: { id: second.grant.id },
      data: { createdAt: new Date("2025-02-01T00:00:00.000Z") },
    })
    await prisma.shareGrant.update({
      where: { id: third.grant.id },
      data: { createdAt: new Date("2025-03-01T00:00:00.000Z") },
    })
    await prisma.shareGrant.updateMany({
      where: { id: first.grant.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    })

    const otherLocker = await prisma.locker.create({
      data: { userId, name: "Hall", vendor: "mock", vendorLockId: "lock-2" },
    })
    await createShareGrant({ userId, lockerId: otherLocker.id })

    const activeGrants = await listActiveGrants({ userId, lockerId: locker.id })
    expect(activeGrants).toEqual([
      expect.objectContaining({ id: third.grant.id }),
      expect.objectContaining({ id: second.grant.id }),
    ])
    expect(activeGrants[0]).not.toHaveProperty("tokenHash")
    expect(activeGrants[0]).not.toHaveProperty("createdByUserId")
  })
})
