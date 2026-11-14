import { describe, expect, it } from "vitest"
import { checkMagicLinkRateLimit } from "@/lib/auth/rate-limit"
import { createInMemoryRateLimiter } from "@/lib/rate-limit"

const now = Date.parse("2026-11-14T10:00:00.000Z")

describe("checkMagicLinkRateLimit", () => {
  it("allows five magic links per normalized email per ten minutes", async () => {
    const limiter = createInMemoryRateLimiter(() => now)

    for (let i = 0; i < 5; i += 1) {
      await expect(checkMagicLinkRateLimit({
        email: " Ana@Example.com ",
        ip: "203.0.113.1",
        limiter,
      })).resolves.toBe(true)
    }

    await expect(checkMagicLinkRateLimit({
      email: "ana@example.com",
      ip: "203.0.113.1",
      limiter,
    })).resolves.toBe(false)
  })

  it("allows twenty magic links per IP per ten minutes across different emails", async () => {
    const limiter = createInMemoryRateLimiter(() => now)

    for (let i = 0; i < 20; i += 1) {
      await expect(checkMagicLinkRateLimit({
        email: `resident-${i}@example.com`,
        ip: "203.0.113.2",
        limiter,
      })).resolves.toBe(true)
    }

    await expect(checkMagicLinkRateLimit({
      email: "resident-21@example.com",
      ip: "203.0.113.2",
      limiter,
    })).resolves.toBe(false)
  })

  it("allows the request again after the ten-minute window", async () => {
    let currentTime = now
    const limiter = createInMemoryRateLimiter(() => currentTime)

    for (let i = 0; i < 5; i += 1) {
      await checkMagicLinkRateLimit({ email: "ana@example.com", ip: "203.0.113.3", limiter })
    }
    await expect(checkMagicLinkRateLimit({
      email: "ana@example.com",
      ip: "203.0.113.3",
      limiter,
    })).resolves.toBe(false)

    currentTime += 10 * 60_000
    await expect(checkMagicLinkRateLimit({
      email: "ana@example.com",
      ip: "203.0.113.3",
      limiter,
    })).resolves.toBe(true)
  })
})
