import { describe, expect, it } from "vitest"
import {
  authNotice,
  SIGN_IN_LINK_ERROR,
  SIGN_IN_UNAVAILABLE_ERROR,
} from "@/lib/auth/sign-in-notice"

describe("authNotice", () => {
  it("shows nothing when there is no error", () => {
    expect(authNotice(undefined)).toBeNull()
    expect(authNotice(null)).toBeNull()
    expect(authNotice("")).toBeNull()
  })

  it.each(["not_invited", "AccessDenied", "Verification", "Configuration"])(
    "uses the neutral link message for %s",
    (code) => {
      expect(authNotice(code)).toBe(SIGN_IN_LINK_ERROR)
    },
  )

  it("falls back to the generic message for unknown codes", () => {
    expect(authNotice("OAuthAccountNotLinked")).toBe(SIGN_IN_UNAVAILABLE_ERROR)
  })

  it("does not name an invite list in the link message", () => {
    expect(SIGN_IN_LINK_ERROR).not.toMatch(/not invited|not on the list/i)
  })
})
