import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

const IV_BYTES = 12
const TAG_BYTES = 16

function keyBuffer(keyHex: string): Buffer {
  const key = Buffer.from(keyHex, "hex")
  if (key.length !== 32) throw new Error("Encryption key must be 32 bytes of hex")
  return key
}

export function encryptSecret(plaintext: string, keyHex: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv("aes-256-gcm", keyBuffer(keyHex), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url")
}

export function decryptSecret(ciphertext: string, keyHex: string): string {
  const data = Buffer.from(ciphertext, "base64url")
  if (data.length < IV_BYTES + TAG_BYTES) throw new Error("Ciphertext is too short")

  const iv = data.subarray(0, IV_BYTES)
  const tag = data.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const body = data.subarray(IV_BYTES + TAG_BYTES)

  const decipher = createDecipheriv("aes-256-gcm", keyBuffer(keyHex), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8")
}
