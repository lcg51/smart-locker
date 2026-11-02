import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PinPad } from "@/components/pin-pad"
import {
  clearPinState,
  generatePinSalt,
  hashPin,
  parsePinCredential,
  readPinLockState,
  serializePinCredential,
  verifyPin,
  PIN_STORAGE_KEY,
  PIN_UNLOCKED_STORAGE_KEY,
} from "@/lib/pin"

describe("local PIN hashing", () => {
  it("verifies the correct PIN and rejects a wrong PIN", async () => {
    const salt = generatePinSalt()
    const hash = await hashPin("1234", salt)

    await expect(verifyPin("1234", salt, hash)).resolves.toBe(true)
    await expect(verifyPin("0000", salt, hash)).resolves.toBe(false)
  })

  it("uses a random 16-byte salt so equal PINs hash differently", async () => {
    const firstSalt = generatePinSalt()
    const secondSalt = generatePinSalt()
    expect(firstSalt).toMatch(/^[0-9a-f]{32}$/)
    expect(secondSalt).not.toBe(firstSalt)

    const firstHash = await hashPin("1234", firstSalt)
    const secondHash = await hashPin("1234", secondSalt)
    expect(firstHash).toMatch(/^[0-9a-f]{64}$/)
    expect(secondHash).not.toBe(firstHash)
  })

  it("rejects invalid PIN and credential formats", async () => {
    const salt = generatePinSalt()
    await expect(hashPin("123", salt)).rejects.toThrow("invalid_pin")
    await expect(verifyPin("12a4", salt, "0".repeat(64))).resolves.toBe(false)
    await expect(verifyPin("1234", "bad-salt", "0".repeat(64))).resolves.toBe(false)
  })

  it("round-trips only a salted hash credential", () => {
    const salt = "0123456789abcdef0123456789abcdef"
    const hash = "abcdef0123456789".repeat(4)
    const serialized = serializePinCredential(salt, hash)

    expect(serialized).toBe(`${salt}:${hash}`)
    expect(parsePinCredential(serialized)).toEqual({ salt, hash })
    expect(parsePinCredential("1234")).toBeNull()
  })

  it("fails open with an explicit recovery state if local storage cannot be read", () => {
    expect(readPinLockState(
      () => { throw new Error("storage blocked") },
      () => null,
    )).toEqual({ state: "storage-unavailable", credential: null })
  })

  it("opens without a PIN, locks with a PIN, and honors the per-tab unlock flag", () => {
    const salt = "0123456789abcdef0123456789abcdef"
    const hash = "abcdef0123456789".repeat(4)
    const record = `${salt}:${hash}`

    expect(readPinLockState(() => null, () => null)).toEqual({ state: "open", credential: null })
    expect(readPinLockState(() => record, () => null)).toEqual({
      state: "locked",
      credential: { salt, hash },
    })
    expect(readPinLockState(() => record, () => "1")).toEqual({
      state: "open",
      credential: { salt, hash },
    })
  })

  it("clears the PIN and per-tab unlock flag without clearing unrelated storage", () => {
    const localValues = new Map([[PIN_STORAGE_KEY, "salt:hash"], ["other", "keep"]])
    const sessionValues = new Map([[PIN_UNLOCKED_STORAGE_KEY, "1"], ["other", "keep"]])
    const localStore = { removeItem: (key: string) => localValues.delete(key) }
    const sessionStore = { removeItem: (key: string) => sessionValues.delete(key) }

    expect(clearPinState(localStore, sessionStore)).toEqual({ pinRemoved: true, unlockedFlagRemoved: true })

    expect(localValues.has(PIN_STORAGE_KEY)).toBe(false)
    expect(sessionValues.has(PIN_UNLOCKED_STORAGE_KEY)).toBe(false)
    expect(localValues.get("other")).toBe("keep")
    expect(sessionValues.get("other")).toBe("keep")
  })

  it("reports failed PIN removal while still clearing the session unlock flag", () => {
    const sessionValues = new Map([[PIN_UNLOCKED_STORAGE_KEY, "1"]])
    const localStore = { removeItem: () => { throw new Error("storage denied") } }
    const sessionStore = { removeItem: (key: string) => sessionValues.delete(key) }

    expect(clearPinState(localStore, sessionStore)).toEqual({ pinRemoved: false, unlockedFlagRemoved: true })
    expect(sessionValues.has(PIN_UNLOCKED_STORAGE_KEY)).toBe(false)
  })

  it("does not let blocked localStorage prevent sign-out storage cleanup", () => {
    const localDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage")
    const sessionDescriptor = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage")
    const sessionValues = new Map([[PIN_UNLOCKED_STORAGE_KEY, "1"]])
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() { throw new Error("local storage blocked") },
    })
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: { removeItem: (key: string) => sessionValues.delete(key) },
    })

    try {
      expect(clearPinState()).toEqual({ pinRemoved: false, unlockedFlagRemoved: true })
      expect(sessionValues.has(PIN_UNLOCKED_STORAGE_KEY)).toBe(false)
    } finally {
      if (localDescriptor) Object.defineProperty(globalThis, "localStorage", localDescriptor)
      else Reflect.deleteProperty(globalThis, "localStorage")
      if (sessionDescriptor) Object.defineProperty(globalThis, "sessionStorage", sessionDescriptor)
      else Reflect.deleteProperty(globalThis, "sessionStorage")
    }
  })

  it("gives the keypad delete control an accessible name", () => {
    const markup = renderToStaticMarkup(createElement(PinPad, { onComplete: () => {} }))
    expect(markup).toContain('aria-label="Delete last digit"')
  })

  it("disables keypad buttons while a PIN verification is pending", () => {
    const markup = renderToStaticMarkup(createElement(PinPad, { onComplete: () => {}, disabled: true }))
    const firstNumberButton = markup.match(/<button[^>]*>1<\/button>/)?.[0]
    expect(firstNumberButton).toContain('disabled=""')
  })
})
