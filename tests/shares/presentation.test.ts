import { describe, expect, it } from "vitest"
import { formatShareExpiry } from "@/lib/shares/presentation"

describe("formatShareExpiry", () => {
  it("formats a guest link expiry without throwing on Intl options", () => {
    expect(formatShareExpiry(new Date("2026-11-02T15:30:00.000Z"))).toBe("Nov 2, 2026, 3:30 PM")
  })
})
