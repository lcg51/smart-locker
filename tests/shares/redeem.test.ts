import { beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/db"
import { MockLockProvider } from "@/lib/locks/mock"
import { provisionApartment } from "@/lib/ops/provision"
import { createShareGrant } from "@/lib/shares/service"
import { redeemShareToken, resolveShareToken } from "@/lib/shares/redeem"
import { resetDb } from "@/tests/helpers/db"

beforeEach(resetDb)

async function seed() {
  const { userId } = await provisionApartment({
    email: "guest-owner@example.com",
    gatewayId: "gw-guest",
    lockers: [{ name: "Front Door Locker", vendor: "mock", vendorLockId: "guest-lock-1" }],
  })
  const locker = await prisma.locker.findFirstOrThrow({ where: { userId } })
  return { userId, locker }
}

function allowAllLimiter() {
  return { async check() { return true } }
}

describe("resolveShareToken", () => {
  it("returns only the locker and owner details needed by the guest page", async () => {
    const { userId, locker } = await seed()
    const { token } = await createShareGrant({ userId, lockerId: locker.id, guestLabel: "Cleaner" })

    const resolved = await resolveShareToken(token)

    expect(resolved).toEqual(expect.objectContaining({
      ok: true,
      grant: expect.objectContaining({
        guestLabel: "Cleaner",
        locker: expect.objectContaining({
          id: locker.id,
          name: "Front Door Locker",
          user: expect.objectContaining({ guestUnlockEmails: true }),
        }),
      }),
    }))
    if (resolved.ok) {
      expect(resolved.grant).not.toHaveProperty("tokenHash")
    }
  })
})

describe("redeemShareToken", () => {
  it("redeems a valid link and records a guest event", async () => {
    const { userId, locker } = await seed()
    const { token } = await createShareGrant({ userId, lockerId: locker.id, maxUses: 1 })
    const result = await redeemShareToken({
      token,
      ip: "1.1.1.1",
      provider: new MockLockProvider(),
      limiter: allowAllLimiter(),
      sendEmail: async () => true,
    })

    expect(result).toEqual({ ok: true, relockAt: expect.any(Date) })
    expect(await prisma.lockEvent.count({ where: { actorType: "GUEST", success: true } })).toBe(1)
    await expect(prisma.locker.findUniqueOrThrow({ where: { id: locker.id } })).resolves.toMatchObject({ status: "UNLOCKED" })
  })

  it("sets relockAt when a guest unlock succeeds", async () => {
    const { userId, locker } = await seed()
    const { token } = await createShareGrant({ userId, lockerId: locker.id })
    const now = new Date("2026-11-03T10:00:00.000Z")

    const result = await redeemShareToken({
      token,
      ip: "203.0.113.10",
      now,
      relockSeconds: 30,
      provider: new MockLockProvider(),
      limiter: allowAllLimiter(),
    })

    expect(result).toEqual({ ok: true, relockAt: new Date("2026-11-03T10:00:30.000Z") })
    const saved = await prisma.locker.findUniqueOrThrow({ where: { id: locker.id } })
    expect(saved.relockAt).toEqual(new Date("2026-11-03T10:00:30.000Z"))
  })

  it("fails closed for expired, revoked, exhausted, and unknown links", async () => {
    const { userId, locker } = await seed()
    const { token, grant } = await createShareGrant({ userId, lockerId: locker.id, maxUses: 1 })

    await prisma.shareGrant.update({ where: { id: grant.id }, data: { expiresAt: new Date(Date.now() - 1) } })
    await expect(redeemShareToken({ token, ip: "1.1.1.1", limiter: allowAllLimiter() })).resolves.toEqual({ ok: false, reason: "expired" })

    await prisma.shareGrant.update({
      where: { id: grant.id },
      data: { expiresAt: new Date(Date.now() + 60_000), revokedAt: new Date() },
    })
    await expect(redeemShareToken({ token, ip: "1.1.1.1", limiter: allowAllLimiter() })).resolves.toEqual({ ok: false, reason: "revoked" })

    await prisma.shareGrant.update({ where: { id: grant.id }, data: { revokedAt: null, usedCount: 1 } })
    await expect(redeemShareToken({ token, ip: "1.1.1.1", limiter: allowAllLimiter() })).resolves.toEqual({ ok: false, reason: "exhausted" })
    await expect(redeemShareToken({ token: "unknown", ip: "1.1.1.1", limiter: allowAllLimiter() })).resolves.toEqual({ ok: false, reason: "not_found" })
  })

  it("uses the injected timestamp consistently for grant validity", async () => {
    const { userId, locker } = await seed()
    const { token, grant } = await createShareGrant({ userId, lockerId: locker.id, maxUses: 1 })
    const now = new Date("2025-01-01T00:00:00.000Z")
    await prisma.shareGrant.update({
      where: { id: grant.id },
      data: { expiresAt: new Date("2025-01-01T00:01:00.000Z") },
    })

    await expect(redeemShareToken({
      token,
      ip: "1.1.1.1",
      provider: new MockLockProvider(),
      limiter: allowAllLimiter(),
      sendEmail: async () => true,
      now,
      relockSeconds: 30,
    })).resolves.toEqual({ ok: true, relockAt: new Date("2025-01-01T00:00:30.000Z") })
  })

  it("lets exactly one of two concurrent redemptions through a maxUses: 1 grant", async () => {
    const { userId, locker } = await seed()
    const { token, grant } = await createShareGrant({ userId, lockerId: locker.id, maxUses: 1 })
    const provider = new MockLockProvider()
    const sendEmail = async () => true

    const results = await Promise.all([
      redeemShareToken({ token, ip: "1.1.1.1", provider, limiter: allowAllLimiter(), sendEmail }),
      redeemShareToken({ token, ip: "1.1.1.2", provider, limiter: allowAllLimiter(), sendEmail }),
    ])

    expect(results.filter((result) => result.ok)).toHaveLength(1)
    expect((await prisma.shareGrant.findUniqueOrThrow({ where: { id: grant.id } })).usedCount).toBe(1)
    expect(await prisma.lockEvent.count({ where: { actorType: "GUEST", success: true } })).toBe(1)
  })

  it("does not consume a use when the lock fails and records the failure", async () => {
    const { userId, locker } = await seed()
    const { token, grant } = await createShareGrant({ userId, lockerId: locker.id, maxUses: 1 })
    const provider = new MockLockProvider({ failNextUnlock: true })

    await expect(redeemShareToken({ token, ip: "1.1.1.1", provider, limiter: allowAllLimiter() })).resolves.toEqual({ ok: false, reason: "lock_failed" })
    expect((await prisma.shareGrant.findUniqueOrThrow({ where: { id: grant.id } })).usedCount).toBe(0)
    expect(await prisma.lockEvent.findFirst({ where: { lockerId: locker.id, actorType: "GUEST" } })).toMatchObject({
      action: "UNLOCK",
      success: false,
    })
  })

  it("does not call the lock provider when either rate limit is exceeded", async () => {
    const { userId, locker } = await seed()
    const { token } = await createShareGrant({ userId, lockerId: locker.id })
    const checks: string[] = []
    const provider = new MockLockProvider()

    await expect(redeemShareToken({
      token,
      ip: "1.1.1.1",
      provider,
      limiter: {
        async check(key) {
          checks.push(key)
          return false
        },
      },
    })).resolves.toEqual({ ok: false, reason: "rate_limited" })

    expect(checks).toEqual(["share:ip:1.1.1.1"])
    expect(await prisma.lockEvent.count()).toBe(0)
  })

  it("does not report an unlock failure when sending the owner email fails", async () => {
    const { userId, locker } = await seed()
    const { token } = await createShareGrant({ userId, lockerId: locker.id })

    await expect(redeemShareToken({
      token,
      ip: "1.1.1.1",
      provider: new MockLockProvider(),
      limiter: allowAllLimiter(),
      sendEmail: async () => { throw new Error("mail unavailable") },
    })).resolves.toEqual({ ok: true, relockAt: expect.any(Date) })
    expect(await prisma.lockEvent.count({ where: { lockerId: locker.id, success: true } })).toBe(1)
  })

  it("does not change the unlock result when the email sender returns false", async () => {
    const { userId, locker } = await seed()
    const { token } = await createShareGrant({ userId, lockerId: locker.id })

    await expect(redeemShareToken({
      token,
      ip: "1.1.1.1",
      provider: new MockLockProvider(),
      limiter: allowAllLimiter(),
      sendEmail: async () => false,
    })).resolves.toEqual({ ok: true, relockAt: expect.any(Date) })
    expect(await prisma.lockEvent.count({ where: { lockerId: locker.id, success: true } })).toBe(1)
  })

  it("skips the owner notification when the account has no email address", async () => {
    const { userId, locker } = await seed()
    const { token } = await createShareGrant({ userId, lockerId: locker.id })
    await prisma.user.update({ where: { id: userId }, data: { email: null } })
    const sendEmail = vi.fn(async () => true)

    await expect(redeemShareToken({
      token,
      ip: "1.1.1.1",
      provider: new MockLockProvider(),
      limiter: allowAllLimiter(),
      sendEmail,
    })).resolves.toEqual({ ok: true, relockAt: expect.any(Date) })
    expect(sendEmail).not.toHaveBeenCalled()
    expect(await prisma.lockEvent.count({ where: { lockerId: locker.id, success: true } })).toBe(1)
  })
})
