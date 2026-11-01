import { describe, expect, it } from "vitest"
import { isGuestUnlockDisabled } from "@/lib/shares/guest-ui-state"

describe("isGuestUnlockDisabled", () => {
  it("disables the button as soon as the server reports a terminal grant denial", () => {
    expect(isGuestUnlockDisabled({ isPending: false, isCoolingDown: false, canUnlockAgain: false })).toBe(true)
  })

  it("allows another unlock only after cooldown while the grant remains available", () => {
    expect(isGuestUnlockDisabled({ isPending: false, isCoolingDown: false, canUnlockAgain: true })).toBe(false)
    expect(isGuestUnlockDisabled({ isPending: true, isCoolingDown: false, canUnlockAgain: true })).toBe(true)
    expect(isGuestUnlockDisabled({ isPending: false, isCoolingDown: true, canUnlockAgain: true })).toBe(true)
  })
})
