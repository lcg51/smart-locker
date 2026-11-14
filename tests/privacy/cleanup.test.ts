import { randomUUID } from "node:crypto"
import { beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { cleanupExpiredData } from "@/lib/privacy/cleanup"
import { provisionApartment } from "@/lib/ops/provision"
import { resetDb } from "@/tests/helpers/db"

beforeEach(resetDb)

async function seed() {
  const { userId } = await provisionApartment({
    email: "cleanup@example.com",
    gatewayId: "gw-cleanup",
    lockers: [{ name: "Kitchen", vendor: "mock", vendorLockId: "cleanup-lock-1" }],
  })
  const locker = await prisma.locker.findFirstOrThrow({ where: { userId } })
  return { userId, locker }
}

async function seedGrant(input: {
  userId: string
  lockerId: string
  expiresAt: Date
  revokedAt?: Date
}) {
  return prisma.shareGrant.create({
    data: {
      lockerId: input.lockerId,
      createdByUserId: input.userId,
      tokenHash: randomUUID(),
      expiresAt: input.expiresAt,
      maxUses: 5,
      revokedAt: input.revokedAt,
    },
  })
}

async function seedSession(input: { userId: string; expires: Date }) {
  return prisma.session.create({
    data: { userId: input.userId, sessionToken: randomUUID(), expires: input.expires },
  })
}

async function seedVerificationToken(expires: Date) {
  return prisma.verificationToken.create({
    data: { identifier: "cleanup@example.com", token: randomUUID(), expires },
  })
}

async function seedEvent(input: { lockerId: string; createdAt: Date; grantId?: string }) {
  return prisma.lockEvent.create({
    data: {
      lockerId: input.lockerId,
      grantId: input.grantId,
      actorType: "OWNER",
      action: "UNLOCK",
      success: true,
      createdAt: input.createdAt,
    },
  })
}

describe("cleanupExpiredData", () => {
  it("deletes only inactive data older than the retention window", async () => {
    const { userId, locker } = await seed()
    const now = new Date("2026-11-03T00:00:00.000Z")
    const oldGrant = await seedGrant({
      userId,
      lockerId: locker.id,
      expiresAt: new Date("2026-09-01T00:00:00.000Z"),
    })
    const freshGrant = await seedGrant({
      userId,
      lockerId: locker.id,
      expiresAt: new Date("2026-11-02T00:00:00.000Z"),
    })
    const oldSession = await seedSession({ userId, expires: new Date("2026-09-01T00:00:00.000Z") })
    const freshSession = await seedSession({ userId, expires: new Date("2026-11-02T00:00:00.000Z") })
    const oldToken = await seedVerificationToken(new Date("2026-09-01T00:00:00.000Z"))
    const freshToken = await seedVerificationToken(new Date("2026-11-02T00:00:00.000Z"))
    const oldEvent = await seedEvent({ lockerId: locker.id, createdAt: new Date("2025-09-01T00:00:00.000Z") })
    const freshEvent = await seedEvent({ lockerId: locker.id, createdAt: new Date("2026-10-01T00:00:00.000Z") })

    await expect(cleanupExpiredData({ now })).resolves.toEqual({
      grants: 1,
      sessions: 1,
      verificationTokens: 1,
      lockEvents: 1,
    })

    await expect(prisma.shareGrant.findUnique({ where: { id: oldGrant.id } })).resolves.toBeNull()
    await expect(prisma.shareGrant.findUnique({ where: { id: freshGrant.id } })).resolves.not.toBeNull()
    await expect(prisma.session.findUnique({ where: { id: oldSession.id } })).resolves.toBeNull()
    await expect(prisma.session.findUnique({ where: { id: freshSession.id } })).resolves.not.toBeNull()
    await expect(prisma.verificationToken.findUnique({ where: { token: oldToken.token } })).resolves.toBeNull()
    await expect(prisma.verificationToken.findUnique({ where: { token: freshToken.token } })).resolves.not.toBeNull()
    await expect(prisma.lockEvent.findUnique({ where: { id: oldEvent.id } })).resolves.toBeNull()
    await expect(prisma.lockEvent.findUnique({ where: { id: freshEvent.id } })).resolves.not.toBeNull()
  })

  it("deletes a grant revoked before the cutoff even when it has not expired", async () => {
    const { userId, locker } = await seed()
    const now = new Date("2026-11-03T00:00:00.000Z")
    const revoked = await seedGrant({
      userId,
      lockerId: locker.id,
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
      revokedAt: new Date("2026-09-01T00:00:00.000Z"),
    })

    await cleanupExpiredData({ now })

    await expect(prisma.shareGrant.findUnique({ where: { id: revoked.id } })).resolves.toBeNull()
  })

  it("keeps recent lock events when their grant is deleted", async () => {
    const { userId, locker } = await seed()
    const now = new Date("2026-11-03T00:00:00.000Z")
    const oldGrant = await seedGrant({
      userId,
      lockerId: locker.id,
      expiresAt: new Date("2026-09-01T00:00:00.000Z"),
    })
    const recentEvent = await seedEvent({
      lockerId: locker.id,
      grantId: oldGrant.id,
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
    })

    await cleanupExpiredData({ now })

    const saved = await prisma.lockEvent.findUnique({ where: { id: recentEvent.id } })
    expect(saved).toMatchObject({ success: true, grantId: null })
  })

  it("honours a custom retention policy", async () => {
    const { userId, locker } = await seed()
    const now = new Date("2026-11-03T00:00:00.000Z")
    const grant = await seedGrant({
      userId,
      lockerId: locker.id,
      expiresAt: new Date("2026-10-20T00:00:00.000Z"),
    })

    await expect(cleanupExpiredData({
      now,
      retention: { inactiveGrantDays: 7 },
    })).resolves.toMatchObject({ grants: 1 })

    await expect(prisma.shareGrant.findUnique({ where: { id: grant.id } })).resolves.toBeNull()
  })
})
