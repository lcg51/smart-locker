import { beforeEach, describe, expect, it, vi } from "vitest"
import { requireUser } from "@/lib/auth/session"
import { deleteAccount } from "@/lib/account/delete"
import { signOut } from "@/auth"
import { deleteAccountAction } from "@/app/actions/account"

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }))
vi.mock("@/lib/account/delete", () => ({ deleteAccount: vi.fn() }))
vi.mock("@/auth", () => ({ signOut: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe("deleteAccountAction", () => {
  it("deletes the signed-in account and signs out to the auth page", async () => {
    vi.mocked(requireUser).mockResolvedValue({ id: "resident-1", email: "ana@example.com" })

    await deleteAccountAction()

    expect(deleteAccount).toHaveBeenCalledWith("resident-1")
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/auth" })
  })

  it("does not sign out if account deletion fails", async () => {
    vi.mocked(requireUser).mockResolvedValue({ id: "resident-1", email: "ana@example.com" })
    vi.mocked(deleteAccount).mockRejectedValue(new Error("database unavailable"))

    await expect(deleteAccountAction()).rejects.toThrow("database unavailable")
    expect(signOut).not.toHaveBeenCalled()
  })
})
