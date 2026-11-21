import { beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/db"
import { resetEnvCacheForTests } from "@/lib/env"
import { checkQuota, recordVendorCall, ttlockPeriod } from "@/lib/locks/quota"
import { resetDb } from "@/tests/helpers/db"

beforeEach(async () => {
  vi.unstubAllEnvs()
  vi.stubEnv("TTLOCK_MONTHLY_QUOTA", "100")
  vi.stubEnv("TTLOCK_QUOTA_SOFT_LIMIT_PERCENT", "80")
  resetEnvCacheForTests()
  await resetDb()
})

describe("ttlockPeriod", () => {
  it("uses the Beijing (UTC+8) month, matching TTLock's counter", () => {
    expect(ttlockPeriod(new Date("2026-11-30T23:30:00.000Z"))).toBe("2026-12")
    expect(ttlockPeriod(new Date("2026-11-30T15:30:00.000Z"))).toBe("2026-11")
  })
})

describe("recordVendorCall", () => {
  it("accumulates calls in the current period only", async () => {
    await recordVendorCall("ttlock", 3, new Date("2026-11-10T10:00:00.000Z"))
    await recordVendorCall("ttlock", 2, new Date("2026-11-11T10:00:00.000Z"))
    await recordVendorCall("ttlock", 1, new Date("2026-12-01T10:00:00.000Z"))

    const rows = await prisma.vendorApiCall.findMany({ orderBy: { period: "asc" } })
    expect(rows.map((row) => [row.period, row.count])).toEqual([
      ["2026-11", 5],
      ["2026-12", 1],
    ])
  })
})

describe("checkQuota", () => {
  it("allows calls below the soft limit", async () => {
    await recordVendorCall("ttlock", 3)
    await expect(checkQuota({ vendor: "ttlock", kind: "command" })).resolves.toBe("ok")
    await expect(checkQuota({ vendor: "ttlock", kind: "state" })).resolves.toBe("ok")
  })

  it("blocks state reads but allows commands above the soft limit", async () => {
    await recordVendorCall("ttlock", 90)
    await expect(checkQuota({ vendor: "ttlock", kind: "state" })).resolves.toBe("soft_limited")
    await expect(checkQuota({ vendor: "ttlock", kind: "admin" })).resolves.toBe("soft_limited")
    await expect(checkQuota({ vendor: "ttlock", kind: "command" })).resolves.toBe("ok")
  })

  it("blocks commands at the hard limit", async () => {
    await recordVendorCall("ttlock", 100)
    await expect(checkQuota({ vendor: "ttlock", kind: "command" })).resolves.toBe("hard_limited")
  })

  it("disables the guard when no limit is configured", async () => {
    vi.stubEnv("TTLOCK_MONTHLY_QUOTA", "0")
    resetEnvCacheForTests()
    await recordVendorCall("ttlock", 5_000)

    await expect(checkQuota({ vendor: "ttlock", kind: "state" })).resolves.toBe("ok")
    await expect(checkQuota({ vendor: "ttlock", kind: "command" })).resolves.toBe("ok")
  })
})
