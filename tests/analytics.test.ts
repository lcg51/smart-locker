import { describe, expect, it } from "vitest"
import { shouldTrackPageview } from "@/lib/analytics"

describe("shouldTrackPageview", () => {
  it("never tracks credential-bearing guest share paths", () => {
    expect(shouldTrackPageview("/share/secret-token")).toBe(false)
  })

  it("continues tracking non-share routes and fails closed without a path", () => {
    expect(shouldTrackPageview("/dashboard")).toBe(true)
    expect(shouldTrackPageview(null)).toBe(false)
  })
})
