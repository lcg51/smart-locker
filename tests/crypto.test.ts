import { describe, expect, it } from "vitest"
import { decryptSecret, encryptSecret } from "@/lib/crypto"

const key = "a".repeat(64)

describe("credential encryption", () => {
  it("round-trips a secret", () => {
    const ciphertext = encryptSecret("access-token", key)
    expect(ciphertext).not.toContain("access-token")
    expect(decryptSecret(ciphertext, key)).toBe("access-token")
  })

  it("rejects a tampered ciphertext", () => {
    const ciphertext = encryptSecret("access-token", key)
    const tampered = `${ciphertext.slice(0, -2)}aa`
    expect(() => decryptSecret(tampered, key)).toThrow()
  })

  it("rejects a ciphertext opened with a different key", () => {
    const ciphertext = encryptSecret("access-token", key)
    expect(() => decryptSecret(ciphertext, "b".repeat(64))).toThrow()
  })
})
