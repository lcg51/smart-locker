import { beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/db"
import { resetEnvCacheForTests } from "@/lib/env"
import { provisionApartment } from "@/lib/ops/provision"
import { createInMemoryRateLimiter } from "@/lib/rate-limit"
import { redeemShareToken, resolveShareToken } from "@/lib/shares/redeem"
import { createShareGrant, listActiveGrants, revokeShareGrant } from "@/lib/shares/service"
import { hashShareToken } from "@/lib/shares/token"
import { resetDb } from "@/tests/helpers/db"

beforeEach(async () => {
  vi.unstubAllEnvs()
  resetEnvCacheForTests()
  await resetDb()
})

function allowAllLimiter() {
  return { async check() { return true } }
}

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

  it("rejects share creation after ten grants in an hour", async () => {
    const { userId, locker } = await seed()
    const now = new Date("2026-11-14T10:00:00.000Z")
    const limiter = createInMemoryRateLimiter(() => now.getTime())

    for (let i = 0; i < 10; i += 1) {
      await createShareGrant({ userId, lockerId: locker.id, limiter, now })
    }

    await expect(createShareGrant({ userId, lockerId: locker.id, limiter, now }))
      .rejects.toMatchObject({ code: "rate_limited" })
  })

  it("caps active grants at twenty per locker", async () => {
    const { userId, locker } = await seed()
    const now = new Date("2026-11-14T10:00:00.000Z")
    const limiter = allowAllLimiter()

    for (let i = 0; i < 20; i += 1) {
      await createShareGrant({ userId, lockerId: locker.id, limiter, now })
    }

    await expect(createShareGrant({ userId, lockerId: locker.id, limiter, now }))
      .rejects.toMatchObject({ code: "share_limit_reached" })
  })

  it("refuses to create or redeem a share while sharing is disabled", async () => {
    const { userId, locker } = await seed()
    const { token } = await createShareGrant({ userId, lockerId: locker.id })

    vi.stubEnv("SHARING_ENABLED", "false")
    resetEnvCacheForTests()

    await expect(createShareGrant({ userId, lockerId: locker.id }))
      .rejects.toMatchObject({ code: "sharing_disabled" })
    await expect(redeemShareToken({ token, ip: "203.0.113.1" }))
      .resolves.toEqual({ ok: false, reason: "sharing_disabled" })
  })

  it("refuses guest redemption while unlock commands are disabled", async () => {
    const { userId, locker } = await seed()
    const { token } = await createShareGrant({ userId, lockerId: locker.id })

    vi.stubEnv("LOCK_COMMANDS_ENABLED", "false")
    resetEnvCacheForTests()

    await expect(resolveShareToken(token)).resolves.toEqual({
      ok: false,
      reason: "commands_disabled",
    })
    await expect(redeemShareToken({ token, ip: "203.0.113.1" }))
      .resolves.toEqual({ ok: false, reason: "commands_disabled" })
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
