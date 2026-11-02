export const PIN_STORAGE_KEY = "smart-locker-pin"
export const PIN_UNLOCKED_STORAGE_KEY = "smart-locker-unlocked"

export type PinCredential = { salt: string; hash: string }
export type PinLockState = "open" | "locked" | "invalid" | "storage-unavailable"

const SALT_PATTERN = /^[0-9a-f]{32}$/i
const HASH_PATTERN = /^[0-9a-f]{64}$/i
const PIN_PATTERN = /^\d{4}$/
const PBKDF2_ITERATIONS = 100_000

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2))
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

export function generatePinSalt(): string {
  return bytesToHex(globalThis.crypto.getRandomValues(new Uint8Array(16)))
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  if (!PIN_PATTERN.test(pin)) throw new Error("invalid_pin")
  if (!SALT_PATTERN.test(salt)) throw new Error("invalid_pin_salt")

  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  )
  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToBytes(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    256,
  )
  return bytesToHex(new Uint8Array(bits))
}

export async function verifyPin(pin: string, salt: string, hash: string): Promise<boolean> {
  if (!PIN_PATTERN.test(pin) || !SALT_PATTERN.test(salt) || !HASH_PATTERN.test(hash)) return false
  const actualHash = await hashPin(pin, salt)
  return constantTimeEqual(actualHash, hash.toLowerCase())
}

export function serializePinCredential(salt: string, hash: string): string {
  if (!SALT_PATTERN.test(salt) || !HASH_PATTERN.test(hash)) throw new Error("invalid_pin_credential")
  return `${salt.toLowerCase()}:${hash.toLowerCase()}`
}

export function parsePinCredential(value: string | null): PinCredential | null {
  if (!value) return null
  const [salt, hash, extra] = value.split(":")
  if (extra !== undefined || !SALT_PATTERN.test(salt) || !HASH_PATTERN.test(hash)) return null
  return { salt: salt.toLowerCase(), hash: hash.toLowerCase() }
}

export function readPinLockState(
  readPinRecord: () => string | null,
  readSessionFlag: () => string | null,
): { state: PinLockState; credential: PinCredential | null } {
  let storedPin: string | null
  try {
    storedPin = readPinRecord()
  } catch {
    return { state: "storage-unavailable", credential: null }
  }

  if (storedPin === null) return { state: "open", credential: null }

  const credential = parsePinCredential(storedPin)
  if (!credential) return { state: "invalid", credential: null }

  try {
    return {
      state: readSessionFlag() === "1" ? "open" : "locked",
      credential,
    }
  } catch {
    return { state: "locked", credential }
  }
}

export function clearPinState(
  localStore?: Pick<Storage, "removeItem">,
  sessionStore?: Pick<Storage, "removeItem">,
): { pinRemoved: boolean; unlockedFlagRemoved: boolean } {
  let pinRemoved = false
  let unlockedFlagRemoved = false

  try {
    const store = localStore ?? globalThis.localStorage
    store.removeItem(PIN_STORAGE_KEY)
    pinRemoved = true
  } catch {
    // Storage can be unavailable in restrictive browser contexts.
  }
  try {
    const store = sessionStore ?? globalThis.sessionStorage
    store.removeItem(PIN_UNLOCKED_STORAGE_KEY)
    unlockedFlagRemoved = true
  } catch {
    // Still attempt to clear the other storage even if one fails.
  }
  return { pinRemoved, unlockedFlagRemoved }
}
