import { beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/db"
import { requireUser } from "@/lib/auth/session"
import { setGuestUnlockEmails } from "@/app/actions/account"
import { resetDb } from "@/tests/helpers/db"

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

beforeEach(async () => {
  vi.mocked(requireUser).mockReset()
  await resetDb()
})

describe("setGuestUnlockEmails", () => {
  it("updates only the signed-in user's notification preference", async () => {
    const currentUser = await prisma.user.create({ data: { email: "current@example.com" } })
    const otherUser = await prisma.user.create({ data: { email: "other@example.com" } })
    vi.mocked(requireUser).mockResolvedValue({ id: currentUser.id, email: currentUser.email! })

    await setGuestUnlockEmails(currentUser.id, false)

    await expect(prisma.user.findUniqueOrThrow({ where: { id: currentUser.id } })).resolves.toMatchObject({ guestUnlockEmails: false })
    await expect(prisma.user.findUniqueOrThrow({ where: { id: otherUser.id } })).resolves.toMatchObject({ guestUnlockEmails: true })
  })

  it("rejects values that are not booleans", async () => {
    const currentUser = await prisma.user.create({ data: { email: "current@example.com" } })
    vi.mocked(requireUser).mockResolvedValue({ id: currentUser.id, email: currentUser.email! })

    await expect(setGuestUnlockEmails(currentUser.id, "false" as unknown as boolean)).rejects.toThrow("invalid_guest_unlock_email_preference")
    await expect(prisma.user.findUniqueOrThrow({ where: { id: currentUser.id } })).resolves.toMatchObject({ guestUnlockEmails: true })
  })

  it("does not let a signed-in user change another account's preference", async () => {
    const currentUser = await prisma.user.create({ data: { email: "current@example.com" } })
    const otherUser = await prisma.user.create({ data: { email: "other@example.com" } })
    vi.mocked(requireUser).mockResolvedValue({ id: currentUser.id, email: currentUser.email! })

    await expect(setGuestUnlockEmails(otherUser.id, false)).rejects.toThrow("unauthorized_account_update")
    await expect(prisma.user.findUniqueOrThrow({ where: { id: currentUser.id } })).resolves.toMatchObject({ guestUnlockEmails: true })
    await expect(prisma.user.findUniqueOrThrow({ where: { id: otherUser.id } })).resolves.toMatchObject({ guestUnlockEmails: true })
  })
})
