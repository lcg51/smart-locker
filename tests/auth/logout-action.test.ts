import { expect, it, vi } from "vitest"

vi.mock("@/auth", () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

import * as authPageActions from "@/app/auth/actions"
import { logout as dashboardLogout } from "@/app/actions/auth"
import { signOut } from "@/auth"

it("signs out through Auth.js and redirects to sign-in", async () => {
  await dashboardLogout()

  expect(signOut).toHaveBeenCalledWith({ redirectTo: "/auth" })
})

it("keeps the sign-in action module free of a duplicate logout export", () => {
  expect(authPageActions).not.toHaveProperty("logout")
})
