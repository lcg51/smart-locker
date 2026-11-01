import { beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { provisionApartment } from "@/lib/ops/provision"
import { resetDb } from "@/tests/helpers/db"

beforeEach(resetDb)

describe("provisionApartment", () => {
  it("creates the allowlist entry, user, gateway, and lockers", async () => {
    const { userId } = await provisionApartment({
      email: "Ana@Example.com",
      gatewayId: "gw-1",
      lockers: [{ name: "Kitchen", vendor: "mock", vendorLockId: "lock-1" }],
    })

    expect(await prisma.allowedEmail.findUnique({ where: { email: "ana@example.com" } })).not.toBeNull()
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    expect(user.vendorGatewayId).toBe("gw-1")
    expect(await prisma.locker.count({ where: { userId } })).toBe(1)
  })

  it("is idempotent for the same email and locker", async () => {
    const input = {
      email: "ana@example.com",
      gatewayId: "gw-1",
      lockers: [{ name: "Kitchen", vendor: "mock", vendorLockId: "lock-1" }],
    }
    await provisionApartment(input)
    await provisionApartment(input)

    expect(await prisma.user.count()).toBe(1)
    expect(await prisma.locker.count()).toBe(1)
  })

  it("does not transfer a locker to a different resident", async () => {
    const locker = { name: "Kitchen", vendor: "mock", vendorLockId: "lock-1" }
    const { userId } = await provisionApartment({
      email: "ana@example.com",
      gatewayId: "gw-1",
      lockers: [locker],
    })

    await expect(
      provisionApartment({
        email: "another@example.com",
        gatewayId: "gw-2",
        lockers: [locker],
      }),
    ).rejects.toThrow("Locker is already provisioned to another resident")

    const storedLocker = await prisma.locker.findUniqueOrThrow({
      where: { vendor_vendorLockId: { vendor: locker.vendor, vendorLockId: locker.vendorLockId } },
    })
    expect(storedLocker.userId).toBe(userId)
    expect(await prisma.user.count()).toBe(1)
  })
})
