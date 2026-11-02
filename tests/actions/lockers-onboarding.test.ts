import { beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/db"
import { requireUser } from "@/lib/auth/session"
import { provisionApartment } from "@/lib/ops/provision"
import { confirmLockerAction, renameLockerAction } from "@/app/actions/lockers"
import { resetDb } from "@/tests/helpers/db"

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

beforeEach(async () => {
  vi.mocked(requireUser).mockReset()
  await resetDb()
})

async function seed(email: string, lockId: string) {
  const { userId } = await provisionApartment({
    email,
    gatewayId: `gateway-${lockId}`,
    lockers: [{ name: "Room 1", vendor: "mock", vendorLockId: lockId }],
  })
  const locker = await prisma.locker.findFirstOrThrow({ where: { userId } })
  return { userId, locker }
}

describe("onboarding locker actions", () => {
  it("renames using the signed-in user's identity and submitted form value", async () => {
    const { userId, locker } = await seed("ana@example.com", "lock-action-1")
    vi.mocked(requireUser).mockResolvedValue({ id: userId, email: "ana@example.com" })
    const formData = new FormData()
    formData.set("name", "  Pantry  ")

    await expect(renameLockerAction(locker.id, formData)).resolves.toBe(true)
    await expect(prisma.locker.findUniqueOrThrow({ where: { id: locker.id } })).resolves.toMatchObject({
      name: "Pantry",
      confirmedAt: null,
    })
  })

  it("does not let the signed-in user confirm another resident's locker", async () => {
    const owner = await seed("ana@example.com", "lock-action-2")
    const stranger = await seed("stranger@example.com", "lock-action-3")
    vi.mocked(requireUser).mockResolvedValue({ id: owner.userId, email: "ana@example.com" })

    await expect(confirmLockerAction(stranger.locker.id)).resolves.toBe(false)
    await expect(prisma.locker.findUniqueOrThrow({ where: { id: stranger.locker.id } })).resolves.toMatchObject({ confirmedAt: null })
  })
})
