import { randomUUID } from "node:crypto"
import { beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { provisionApartment } from "@/lib/ops/provision"
import { extendShareGrant } from "@/lib/shares/service"
import { resetDb } from "@/tests/helpers/db"

beforeEach(resetDb)

async function seed() {
  const { userId } = await provisionApartment({
    email: "ana@example.com",
    gatewayId: "gw-extension",
    lockers: [{ name: "Kitchen", vendor: "mock", vendorLockId: "extension-lock" }],
  })
  const locker = await prisma.locker.findFirstOrThrow({ where: { userId } })
  return { userId, lockerId: locker.id }
}

async function createLiveGrant(input: {
  userId: string
  lockerId: string
  expiresAt: Date
  maxUses?: number
  revokedAt?: Date
}) {
  return prisma.shareGrant.create({
    data: {
      lockerId: input.lockerId,
      createdByUserId: input.userId,
      tokenHash: randomUUID(),
      expiresAt: input.expiresAt,
      maxUses: input.maxUses ?? 5,
      revokedAt: input.revokedAt,
    },
  })
}

describe("extendShareGrant", () => {
  it("extends a live grant within the caps and records an event", async () => {
    const { userId, lockerId } = await seed()
    const now = new Date("2026-11-03T10:00:00.000Z")
    const grant = await createLiveGrant({
      userId,
      lockerId,
      expiresAt: new Date(now.getTime() + 30 * 60_000),
      maxUses: 5,
    })

    const result = await extendShareGrant({
      userId,
      grantId: grant.id,
      additionalMinutes: 60,
      additionalUses: 2,
      now,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.grant.expiresAt).toEqual(new Date(now.getTime() + 90 * 60_000))
    expect(result.grant.maxUses).toBe(7)
    const event = await prisma.shareGrantEvent.findFirstOrThrow({
      where: { grantId: grant.id, action: "EXTENDED" },
    })
    expect(event).toMatchObject({
      action: "EXTENDED",
      actorType: "OWNER",
      detail: "+60 minutes, +2 uses",
    })
  })

  it("refuses to extend a revoked or expired grant", async () => {
    const { userId, lockerId } = await seed()
    const now = new Date("2026-11-03T10:00:00.000Z")
    const revoked = await createLiveGrant({
      userId,
      lockerId,
      expiresAt: new Date(now.getTime() + 60 * 60_000),
      revokedAt: now,
    })
    const expired = await createLiveGrant({
      userId,
      lockerId,
      expiresAt: new Date(now.getTime() - 60_000),
    })

    await expect(extendShareGrant({ userId, grantId: revoked.id, additionalMinutes: 60, now }))
      .resolves.toEqual({ ok: false, error: "revoked" })
    await expect(extendShareGrant({ userId, grantId: expired.id, additionalMinutes: 60, now }))
      .resolves.toEqual({ ok: false, error: "expired" })
  })

  it("caps the expiry at 1440 minutes from the extension time and uses at 50", async () => {
    const { userId, lockerId } = await seed()
    const now = new Date("2026-11-03T10:00:00.000Z")
    const live = await createLiveGrant({
      userId,
      lockerId,
      expiresAt: new Date(now.getTime() + 30 * 60_000),
      maxUses: 5,
    })

    const result = await extendShareGrant({
      userId,
      grantId: live.id,
      additionalMinutes: 2000,
      additionalUses: 100,
      now,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.grant.expiresAt).toEqual(new Date(now.getTime() + 1440 * 60_000))
    expect(result.grant.maxUses).toBe(50)
  })

  it("rejects an extension with no positive values", async () => {
    const { userId, lockerId } = await seed()
    const now = new Date("2026-11-03T10:00:00.000Z")
    const grant = await createLiveGrant({
      userId,
      lockerId,
      expiresAt: new Date(now.getTime() + 30 * 60_000),
    })

    await expect(extendShareGrant({ userId, grantId: grant.id, now }))
      .resolves.toEqual({ ok: false, error: "invalid_extension" })
    await expect(extendShareGrant({ userId, grantId: grant.id, additionalMinutes: 0, now }))
      .resolves.toEqual({ ok: false, error: "invalid_extension" })
    await expect(extendShareGrant({ userId, grantId: grant.id, additionalUses: -1, now }))
      .resolves.toEqual({ ok: false, error: "invalid_extension" })
  })

  it("does not let another resident extend the link", async () => {
    const { userId, lockerId } = await seed()
    const now = new Date("2026-11-03T10:00:00.000Z")
    const grant = await createLiveGrant({
      userId,
      lockerId,
      expiresAt: new Date(now.getTime() + 30 * 60_000),
    })
    const beto = await prisma.user.create({ data: { email: "beto@example.com" } })

    await expect(extendShareGrant({
      userId: beto.id,
      grantId: grant.id,
      additionalMinutes: 60,
      now,
    })).resolves.toEqual({ ok: false, error: "not_found" })
  })
})
