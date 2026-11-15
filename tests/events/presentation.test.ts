import { describe, expect, it } from "vitest"
import { describeEvent, formatEventTime } from "@/lib/events/presentation"

describe("formatEventTime", () => {
  it("formats event time in Madrid time with a timezone label", () => {
    const text = formatEventTime(new Date("2026-11-03T10:00:00.000Z"))
    expect(text).toContain("11:00")
    expect(text).toMatch(/CET|CEST|GMT\+1|GMT\+2/)
  })

  it("formats Spanish dates with the Spanish locale", () => {
    const text = formatEventTime(new Date("2026-11-03T10:00:00.000Z"), "es")
    expect(text).toContain("11:00")
    expect(text).toMatch(/nov|CET|GMT\+1/)
  })
})

describe("describeEvent", () => {
  it("uses the guest label and a friendly failure reason", () => {
    expect(describeEvent({
      actorType: "GUEST",
      grant: { guestLabel: "Cleaner" },
      action: "UNLOCK",
      success: false,
      errorCode: "provider_error",
    })).toEqual({
      actor: "Cleaner",
      action: "Unlock",
      result: "Failed",
      detail: "The lock provider did not respond.",
    })
  })

  it("falls back to Guest when the grant has no label", () => {
    expect(describeEvent({
      actorType: "GUEST",
      grant: { guestLabel: null },
      action: "UNLOCK",
      success: true,
      errorCode: null,
    })).toEqual({
      actor: "Guest",
      action: "Unlock",
      result: "Succeeded",
      detail: null,
    })
  })

  it("names residents and system actors", () => {
    expect(describeEvent({
      actorType: "OWNER",
      grant: null,
      action: "LOCK",
      success: true,
      errorCode: null,
    }).actor).toBe("Resident")
    expect(describeEvent({
      actorType: "SYSTEM",
      grant: null,
      action: "LOCK",
      success: false,
      errorCode: "rate_limited",
    })).toMatchObject({
      actor: "System",
      action: "Lock",
      result: "Failed",
      detail: "Too many attempts. Try again shortly.",
    })
  })

  it("uses a generic detail for an unknown error code", () => {
    expect(describeEvent({
      actorType: "OWNER",
      grant: null,
      action: "UNLOCK",
      success: false,
      errorCode: "something_new",
    }).detail).toBe("The locker did not respond.")
  })
})
