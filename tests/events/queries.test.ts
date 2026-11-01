import { beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { provisionApartment } from "@/lib/ops/provision"
import { listLockEvents } from "@/lib/events/queries"
import { resetDb } from "@/tests/helpers/db"

beforeEach(resetDb)

async function seed(email = "ana@example.com") {
  const { userId } = await provisionApartment({
    email,
    gatewayId: `gw-${email}`,
    lockers: [{ name: "Kitchen", vendor: "mock", vendorLockId: `lock-${email}` }],
  })
  const locker = await prisma.locker.findFirstOrThrow({ where: { userId } })
  return { userId, locker }
}

describe("listLockEvents", () => {
  it("returns only owner events, newest first, with cursor pagination", async () => {
    const { userId, locker } = await seed()
    const stranger = await seed("stranger@example.com")
    const older = await prisma.lockEvent.create({
      data: { lockerId: locker.id, actorType: "OWNER", action: "UNLOCK", success: true, createdAt: new Date("2025-01-01T00:00:00.000Z") },
    })
    const middle = await prisma.lockEvent.create({
      data: { lockerId: locker.id, actorType: "GUEST", action: "UNLOCK", success: false, createdAt: new Date("2025-01-02T00:00:00.000Z") },
    })
    const newest = await prisma.lockEvent.create({
      data: { lockerId: locker.id, actorType: "GUEST", action: "UNLOCK", success: true, createdAt: new Date("2025-01-03T00:00:00.000Z") },
    })
    await prisma.lockEvent.create({
      data: { lockerId: stranger.locker.id, actorType: "OWNER", action: "UNLOCK", success: true, createdAt: new Date("2025-02-01T00:00:00.000Z") },
    })

    const first = await listLockEvents({ userId, limit: 2 })
    expect(first.events.map((event) => event.id)).toEqual([newest.id, middle.id])
    expect(first.events.every((event) => event.lockerId === locker.id)).toBe(true)
    expect(first.nextCursor).toBe(middle.id)

    const second = await listLockEvents({ userId, limit: 2, cursor: first.nextCursor! })
    expect(second.events.map((event) => event.id)).toEqual([older.id])
    expect(second.nextCursor).toBeNull()
  })

  it("filters events by an owner locker and clamps page sizes to 1 through 100", async () => {
    const { userId, locker } = await seed()
    const secondLocker = await prisma.locker.create({
      data: { userId, name: "Hall", vendor: "mock", vendorLockId: "lock-hall" },
    })
    await prisma.lockEvent.createMany({
      data: [...Array.from({ length: 102 }, () => locker.id), secondLocker.id].map((lockerId) => ({
        lockerId,
        actorType: "OWNER" as const,
        action: "LOCK" as const,
        success: true,
      })),
    })

    const filtered = await listLockEvents({ userId, lockerId: secondLocker.id })
    expect(filtered.events).toHaveLength(1)
    expect(filtered.events[0].lockerId).toBe(secondLocker.id)

    const minimum = await listLockEvents({ userId, limit: 0 })
    expect(minimum.events).toHaveLength(1)
    expect(minimum.nextCursor).not.toBeNull()

    const maximum = await listLockEvents({ userId, limit: 101 })
    expect(maximum.events).toHaveLength(100)
    expect(maximum.nextCursor).not.toBeNull()
  })
})
