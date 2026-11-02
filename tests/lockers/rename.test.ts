import { beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { provisionApartment } from "@/lib/ops/provision"
import { confirmLocker, renameLocker } from "@/lib/lockers/service"
import { canConfirmLockerName } from "@/lib/lockers/onboarding"
import { resetDb } from "@/tests/helpers/db"

beforeEach(resetDb)

async function seed() {
  const { userId } = await provisionApartment({
    email: "ana@example.com",
    gatewayId: "gateway-onboarding",
    lockers: [{ name: "Room 1", vendor: "mock", vendorLockId: "lock-onboarding-1" }],
  })
  const locker = await prisma.locker.findFirstOrThrow({ where: { userId } })
  return { userId, locker }
}

describe("locker onboarding operations", () => {
  it("only allows confirmation after the current name has been saved", () => {
    expect(canConfirmLockerName("Kitchen", "Kitchen")).toBe(true)
    expect(canConfirmLockerName("  Kitchen  ", "Kitchen")).toBe(true)
    expect(canConfirmLockerName("Pantry", "Kitchen")).toBe(false)
  })

  it("renames and confirms only the owner's active locker", async () => {
    const { userId, locker } = await seed()
    const stranger = await prisma.user.create({ data: { email: "stranger@example.com" } })

    await expect(renameLocker({ userId: stranger.id, lockerId: locker.id, name: "Mine" })).resolves.toBe(false)
    await expect(confirmLocker({ userId: stranger.id, lockerId: locker.id })).resolves.toBe(false)
    await expect(renameLocker({ userId, lockerId: locker.id, name: "  Pantry  " })).resolves.toBe(true)

    const updated = await prisma.locker.findUniqueOrThrow({ where: { id: locker.id } })
    expect(updated.name).toBe("Pantry")
    expect(updated.confirmedAt).toBeNull()

    await expect(confirmLocker({ userId, lockerId: locker.id })).resolves.toBe(true)
    expect((await prisma.locker.findUniqueOrThrow({ where: { id: locker.id } })).confirmedAt).not.toBeNull()
  })

  it("rejects blank or overlong names and deleted lockers", async () => {
    const { userId, locker } = await seed()

    await expect(renameLocker({ userId, lockerId: locker.id, name: "   " })).resolves.toBe(false)
    await expect(renameLocker({ userId, lockerId: locker.id, name: "x".repeat(41) })).resolves.toBe(false)
    await prisma.locker.update({ where: { id: locker.id }, data: { deletedAt: new Date() } })
    await expect(renameLocker({ userId, lockerId: locker.id, name: "Pantry" })).resolves.toBe(false)
    await expect(confirmLocker({ userId, lockerId: locker.id })).resolves.toBe(false)
  })
})
