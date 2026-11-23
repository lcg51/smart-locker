import { describe, expect, it } from "vitest"
import { defaultLocale, isLocale, locales } from "@/lib/i18n/config"
import { en } from "@/lib/i18n/dictionaries/en"
import { es } from "@/lib/i18n/dictionaries/es"
import { fill } from "@/lib/i18n/format"

function keysOf(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix]
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    keysOf(child, prefix ? `${prefix}.${key}` : key),
  )
}

function getValue(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => {
    if (value === null || typeof value !== "object") return undefined
    return (value as Record<string, unknown>)[key]
  }, source)
}

describe("dictionaries", () => {
  it("has the same keys in English and Spanish", () => {
    expect(keysOf(es)).toEqual(keysOf(en))
  })

  it("does not leave an empty Spanish value", () => {
    for (const key of keysOf(en)) {
      expect(String(getValue(es, key)).trim()).not.toBe("")
    }
  })

  it("keeps the Spanish headings the localization flow relies on", () => {
    expect(es.settings.title).toBe("Ajustes")
    expect(es.dashboard.title).toBe("Tus taquillas")
    expect(es.auth.title).toBe("Smart Locker")
  })
})

describe("fill", () => {
  it("replaces named placeholders", () => {
    expect(fill("{used} of {max} unlocks used", { used: 2, max: 5 })).toBe(
      "2 of 5 unlocks used",
    )
  })

  it("leaves unknown placeholders untouched", () => {
    expect(fill("Hello {name}", {})).toBe("Hello {name}")
  })
})

describe("isLocale", () => {
  it("accepts the supported locales only", () => {
    expect(locales).toEqual(["en", "es"])
    expect(defaultLocale).toBe("en")
    expect(isLocale("es")).toBe(true)
    expect(isLocale("en")).toBe(true)
    expect(isLocale("fr")).toBe(false)
    expect(isLocale(undefined)).toBe(false)
  })
})
