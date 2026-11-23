import { describe, expect, it } from "vitest"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { formatShareDetail, formatShareExpiry } from "@/lib/shares/presentation"

const en = getDictionary("en")
const es = getDictionary("es")

describe("formatShareExpiry", () => {
  it("formats a guest link expiry with an explicit timezone", () => {
    expect(formatShareExpiry(new Date("2026-11-02T15:30:00.000Z"))).toBe("2 Nov 2026, 15:30 UTC")
  })

  it("formats a guest link expiry in Spanish", () => {
    const text = formatShareExpiry(new Date("2026-11-02T15:30:00.000Z"), "es")
    expect(text).toContain("nov")
    expect(text).toContain("UTC")
  })
})

describe("formatShareDetail", () => {
  it.each([
    ["60 minutes, 5 uses", "60 minutes, 5 uses"],
    ["+30 minutes, +2 uses", "+30 minutes, +2 uses"],
    ["+30 minutes", "+30 minutes"],
    ["+2 uses", "+2 uses"],
    ["No change", "No change"],
  ])("keeps the English detail %s", (detail, expected) => {
    expect(formatShareDetail(detail, en)).toBe(expected)
  })

  it.each([
    ["60 minutes, 5 uses", "60 minutos, 5 usos"],
    ["+30 minutes, +2 uses", "+30 minutos, +2 usos"],
    ["+30 minutes", "+30 minutos"],
    ["+2 uses", "+2 usos"],
    ["No change", "Sin cambios"],
  ])("translates the known detail %s", (detail, expected) => {
    expect(formatShareDetail(detail, es)).toBe(expected)
  })

  it("leaves an unrecognized detail unchanged", () => {
    expect(formatShareDetail("Custom note", es)).toBe("Custom note")
  })
})
