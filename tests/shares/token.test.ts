import { describe, expect, it } from "vitest"
import { generateShareToken, hashShareToken } from "@/lib/shares/token"

describe("share tokens", () => {
  it("generates 32 random bytes as base64url", () => {
    const token = generateShareToken()
    expect(token).toHaveLength(43)
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(token).not.toBe(generateShareToken())
  })

  it("hashes deterministically to 64 hex characters", () => {
    const token = generateShareToken()
    expect(hashShareToken(token)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashShareToken(token)).toBe(hashShareToken(token))
  })
})
