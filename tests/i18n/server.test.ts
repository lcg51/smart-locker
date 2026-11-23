import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  acceptLanguage: undefined as string | undefined,
}))

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      state.cookie === undefined ? undefined : { name, value: state.cookie },
  })),
  headers: vi.fn(async () => new Headers(
    state.acceptLanguage === undefined ? {} : { "accept-language": state.acceptLanguage },
  )),
}))

import { getLocale } from "@/lib/i18n/server"

beforeEach(() => {
  state.cookie = undefined
  state.acceptLanguage = undefined
})

describe("getLocale", () => {
  it("uses the resident's cookie before the browser preference", () => {
    state.cookie = "es"
    state.acceptLanguage = "en-GB"

    return expect(getLocale()).resolves.toBe("es")
  })

  it("falls back to Spanish Accept-Language when there is no cookie", () => {
    state.acceptLanguage = "es-ES,es;q=0.9,en;q=0.8"

    return expect(getLocale()).resolves.toBe("es")
  })

  it("ignores an unsupported cookie and uses Accept-Language", async () => {
    state.cookie = "fr"
    state.acceptLanguage = "es-ES"

    await expect(getLocale()).resolves.toBe("es")
  })

  it("uses English when neither source has a supported locale", async () => {
    state.acceptLanguage = "en-GB"

    await expect(getLocale()).resolves.toBe("en")

    state.acceptLanguage = undefined
    await expect(getLocale()).resolves.toBe("en")
  })
})
