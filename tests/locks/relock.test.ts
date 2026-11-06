import { beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { MockLockProvider } from "@/lib/locks/mock"
import type { LockProvider } from "@/lib/locks/types"
import { relockDueLockers, relockShareToken } from "@/lib/locks/relock"
import { provisionApartment } from "@/lib/ops/provision"
import { createShareGrant } from "@/lib/shares/service"
import { resetDb } from "@/tests/helpers/db"

beforeEach(resetDb)

async function seed() {
  const { userId } = await provisionApartment({
    email: "relock-owner@example.com",
    gatewayId: "gw-relock",
    lockers: [{ name: "Front Door Locker", vendor: "mock", vendorLockId: "relock-lock-1" }],
  })
  const locker = await prisma.locker.findFirstOrThrow({ where: { userId } })
  const { token } = await createShareGrant({ userId, lockerId: locker.id })
  return { userId, locker, token }
}

function failingLockProvider(): LockProvider {
  return {
    async provision() {
      return { vendorLockId: "unused" }
    },
    async unlock() {
      return { success: true }
    },
    async lock() {
      return { success: false, errorCode: "mock_failure" }
    },
    async getState() {
      return { status: "unlocked", batteryLevel: 100, online: true }
    },
  }
}

describe("relockShareToken", () => {
  it("locks the locker, clears relockAt, and records a system lock event", async () => {
    const { locker, token } = await seed()
    await prisma.locker.update({
      where: { id: locker.id },
      data: { relockAt: new Date("2026-11-03T10:00:30.000Z") },
    })
    const provider = new MockLockProvider()
    await provider.unlock(locker.vendorLockId)

    await expect(relockShareToken({
      token,
      provider,
      now: new Date("2026-11-03T10:00:31.000Z"),
    })).resolves.toEqual({ ok: true })

    expect((await provider.getState(locker.vendorLockId)).status).toBe("locked")
    const saved = await prisma.locker.findUniqueOrThrow({ where: { id: locker.id } })
    expect(saved.relockAt).toBeNull()
    expect(saved.status).toBe("LOCKED")
    const event = await prisma.lockEvent.findFirstOrThrow({
      where: { lockerId: locker.id, actorType: "SYSTEM" },
    })
    expect(event).toMatchObject({ action: "LOCK", success: true })
  })

  it("is idempotent when there is no pending relock", async () => {
    const { locker, token } = await seed()
    const provider = new MockLockProvider()

    await expect(relockShareToken({ token, provider })).resolves.toEqual({ ok: true })

    expect(await prisma.lockEvent.count({ where: { lockerId: locker.id } })).toBe(0)
  })

  it("records a failed system event and keeps the deadline when the lock fails", async () => {
    const { locker, token } = await seed()
    const relockAt = new Date("2026-11-03T10:00:30.000Z")
    await prisma.locker.update({ where: { id: locker.id }, data: { relockAt } })

    await expect(relockShareToken({
      token,
      provider: failingLockProvider(),
      now: new Date("2026-11-03T10:00:31.000Z"),
    })).resolves.toEqual({ ok: false, errorCode: "mock_failure" })

    const event = await prisma.lockEvent.findFirstOrThrow({
      where: { lockerId: locker.id, actorType: "SYSTEM" },
    })
    expect(event).toMatchObject({ action: "LOCK", success: false, errorCode: "mock_failure" })
    expect((await prisma.locker.findUniqueOrThrow({ where: { id: locker.id } })).relockAt).toEqual(relockAt)
  })

  it("returns not_found for an unknown token", async () => {
    await expect(relockShareToken({ token: "unknown", provider: new MockLockProvider() }))
      .resolves.toEqual({ ok: false, errorCode: "not_found" })
  })
})

describe("relockDueLockers", () => {
  it("relocks only due lockers", async () => {
    const { locker, token } = await seed()
    const provider = new MockLockProvider()
    await provider.unlock(locker.vendorLockId)
    await prisma.locker.update({
      where: { id: locker.id },
      data: { relockAt: new Date("2026-11-03T10:00:00.000Z") },
    })

    const future = await prisma.locker.create({
      data: {
        userId: locker.userId,
        name: "Future locker",
        vendor: "mock",
        vendorLockId: "relock-lock-2",
        relockAt: new Date("2026-11-03T10:05:00.000Z"),
      },
    })
    const futureGrant = await createShareGrant({
      userId: locker.userId,
      lockerId: future.id,
    })

    await expect(relockDueLockers({
      provider,
      now: new Date("2026-11-03T10:00:01.000Z"),
    })).resolves.toEqual({ relocked: 1, failed: 0 })

    expect((await provider.getState(locker.vendorLockId)).status).toBe("locked")
    expect((await prisma.locker.findUniqueOrThrow({ where: { id: future.id } })).relockAt)
      .toEqual(new Date("2026-11-03T10:05:00.000Z"))
    expect(futureGrant.token).toBeTruthy()
    expect(token).toBeTruthy()
  })

  it("counts failures and leaves the deadline for a retry", async () => {
    const { locker } = await seed()
    await prisma.locker.update({
      where: { id: locker.id },
      data: { relockAt: new Date("2026-11-03T10:00:00.000Z") },
    })

    await expect(relockDueLockers({
      provider: failingLockProvider(),
      now: new Date("2026-11-03T10:00:01.000Z"),
    })).resolves.toEqual({ relocked: 0, failed: 1 })

    expect((await prisma.locker.findUniqueOrThrow({ where: { id: locker.id } })).relockAt)
      .toEqual(new Date("2026-11-03T10:00:00.000Z"))
  })
})
