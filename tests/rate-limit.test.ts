import { describe, expect, it } from "vitest"
import { createInMemoryRateLimiter } from "@/lib/rate-limit"

describe("createInMemoryRateLimiter", () => {
  it("allows the limit and rejects the next call in the window", async () => {
    const limiter = createInMemoryRateLimiter(() => 1_000)

    for (let i = 0; i < 10; i += 1) {
      await expect(limiter.check("ip:1", 10, 60_000)).resolves.toBe(true)
    }
    await expect(limiter.check("ip:1", 10, 60_000)).resolves.toBe(false)
  })

  it("starts fresh after the window", async () => {
    let now = 1_000
    const limiter = createInMemoryRateLimiter(() => now)

    await limiter.check("ip:1", 1, 60_000)
    now = 62_000
    await expect(limiter.check("ip:1", 1, 60_000)).resolves.toBe(true)
  })
})
