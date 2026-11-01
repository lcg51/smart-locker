import { beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { provisionApartment } from "@/lib/ops/provision"
import {
  getLockerForUser,
  getLockersForUser,
} from "@/lib/lockers/queries"
import {
  lockLockerForUser,
  refreshLockerState,
  unlockLockerForUser,
} from "@/lib/lockers/service"
import { MockLockProvider } from "@/lib/locks/mock"
import type { LockProvider } from "@/lib/locks/types"
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

describe("locker queries", () => {
  it("returns only the user's active lockers in creation order", async () => {
    const { userId } = await provisionApartment({
      email: "ana@example.com",
      gatewayId: "gw-1",
      lockers: [
        { name: "Kitchen", vendor: "mock", vendorLockId: "lock-1" },
        { name: "Hall", vendor: "mock", vendorLockId: "lock-2" },
        { name: "Closet", vendor: "mock", vendorLockId: "lock-3" },
      ],
    })
    const lockers = await prisma.locker.findMany({ where: { userId } })
    const kitchen = lockers.find((locker) => locker.name === "Kitchen")!
    const hall = lockers.find((locker) => locker.name === "Hall")!
    const closet = lockers.find((locker) => locker.name === "Closet")!
    await prisma.locker.update({ where: { id: kitchen.id }, data: { createdAt: new Date("2020-01-01") } })
    await prisma.locker.update({ where: { id: hall.id }, data: { createdAt: new Date("2021-01-01") } })
    await prisma.locker.update({ where: { id: closet.id }, data: { deletedAt: new Date() } })
    const other = await prisma.user.create({ data: { email: "other@example.com" } })

    await expect(getLockersForUser(userId)).resolves.toEqual([
      expect.objectContaining({ id: kitchen.id }),
      expect.objectContaining({ id: hall.id }),
    ])
    await expect(getLockerForUser(userId, closet.id)).resolves.toBeNull()
    await expect(getLockerForUser(other.id, hall.id)).resolves.toBeNull()
  })
})

describe("unlockLockerForUser", () => {
  it("unlocks the owner's locker and records an event", async () => {
    const { userId, locker } = await seed()
    const result = await unlockLockerForUser({ userId, lockerId: locker.id, provider: new MockLockProvider() })

    expect(result.ok).toBe(true)
    expect((await prisma.locker.findUniqueOrThrow({ where: { id: locker.id } })).status).toBe("UNLOCKED")
    expect(await prisma.lockEvent.count({ where: { lockerId: locker.id, success: true } })).toBe(1)
  })

  it("treats another resident's locker as not found and writes no event", async () => {
    const { locker } = await seed()
    const stranger = await prisma.user.create({ data: { email: "stranger@example.com" } })
    const result = await unlockLockerForUser({ userId: stranger.id, lockerId: locker.id, provider: new MockLockProvider() })

    expect(result).toEqual({ ok: false, errorCode: "not_found" })
    expect(await prisma.lockEvent.count()).toBe(0)
  })

  it("records a failure when the provider throws and a re-query is still unknown", async () => {
    const { userId, locker } = await seed()
    const provider = {
      unlock: async () => { throw new Error("timeout") },
      getState: async () => { throw new Error("timeout") },
    } as unknown as LockProvider
    const result = await unlockLockerForUser({ userId, lockerId: locker.id, provider })

    expect(result).toEqual({ ok: false, errorCode: "provider_error" })
    expect(await prisma.lockEvent.count({ where: { success: false, errorCode: "provider_error" } })).toBe(1)
  })

  it("treats an unlock as successful when a re-query confirms it", async () => {
    const { userId, locker } = await seed()
    const provider = {
      unlock: async () => { throw new Error("timeout") },
      getState: async () => ({ status: "unlocked", batteryLevel: 90, online: true }),
    } as unknown as LockProvider
    const result = await unlockLockerForUser({ userId, lockerId: locker.id, provider })

    expect(result.ok).toBe(true)
    expect(await prisma.lockEvent.count({ where: { success: true } })).toBe(1)
  })

  it("records a provider-declared failure", async () => {
    const { userId, locker } = await seed()
    const provider = {
      unlock: async () => ({ success: false as const, errorCode: "offline" }),
    } as unknown as LockProvider

    await expect(unlockLockerForUser({ userId, lockerId: locker.id, provider })).resolves.toEqual({
      ok: false,
      errorCode: "offline",
    })
    expect(await prisma.lockEvent.count({ where: { success: false, errorCode: "offline" } })).toBe(1)
  })
})

describe("lockLockerForUser", () => {
  it("locks the owner's locker and records a lock event", async () => {
    const { userId, locker } = await seed()
    const result = await lockLockerForUser({ userId, lockerId: locker.id, provider: new MockLockProvider() })

    expect(result.ok).toBe(true)
    expect((await prisma.locker.findUniqueOrThrow({ where: { id: locker.id } })).status).toBe("LOCKED")
    expect(await prisma.lockEvent.count({ where: { lockerId: locker.id, action: "LOCK", success: true } })).toBe(1)
  })
})

describe("refreshLockerState", () => {
  it("updates the cached state and battery without creating an event", async () => {
    const { userId, locker } = await seed()
    const provider = {
      getState: async () => ({ status: "unlocked", batteryLevel: 75, online: true }),
    } as unknown as LockProvider

    await expect(refreshLockerState({ userId, lockerId: locker.id, provider })).resolves.toEqual({
      ok: true,
      state: { status: "unlocked", batteryLevel: 75, online: true },
    })
    const stored = await prisma.locker.findUniqueOrThrow({ where: { id: locker.id } })
    expect(stored.status).toBe("UNLOCKED")
    expect(stored.batteryLevel).toBe(75)
    expect(await prisma.lockEvent.count()).toBe(0)
  })

  it("does not refresh another resident's locker", async () => {
    const { locker } = await seed()
    const stranger = await prisma.user.create({ data: { email: "stranger@example.com" } })
    const provider = { getState: async () => ({ status: "locked", batteryLevel: 100, online: true }) } as unknown as LockProvider

    await expect(refreshLockerState({ userId: stranger.id, lockerId: locker.id, provider })).resolves.toEqual({
      ok: false,
      errorCode: "not_found",
    })
  })
})
