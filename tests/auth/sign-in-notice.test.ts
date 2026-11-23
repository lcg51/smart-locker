import { describe, expect, it } from "vitest"
import { authNoticeKey } from "@/lib/auth/sign-in-notice"
import { en } from "@/lib/i18n/dictionaries/en"
import { es } from "@/lib/i18n/dictionaries/es"

describe("authNoticeKey", () => {
  it("shows nothing when there is no error", () => {
    expect(authNoticeKey(undefined)).toBeNull()
    expect(authNoticeKey(null)).toBeNull()
    expect(authNoticeKey("")).toBeNull()
  })

  it.each(["not_invited", "AccessDenied", "Verification", "Configuration"])(
    "uses the link notice for %s",
    (code) => {
      expect(authNoticeKey(code)).toBe("link")
    },
  )

  it("falls back to the generic notice for unknown codes", () => {
    expect(authNoticeKey("OAuthAccountNotLinked")).toBe("unavailable")
  })

  it("does not name an invite list in either language", () => {
    expect(en.auth.notice.link).not.toMatch(/not invited|not on the list/i)
    expect(es.auth.notice.link).not.toMatch(/no invitad|no está en la lista/i)
  })
})
