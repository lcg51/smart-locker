import { prisma } from "@/lib/db"
import { getEnv } from "@/lib/env"

export type QuotaKind = "state" | "command" | "admin"
export type QuotaStatus = "ok" | "soft_limited" | "hard_limited"

export class QuotaExceededError extends Error {
  constructor(readonly status: Exclude<QuotaStatus, "ok">) {
    super(`TTLock quota ${status}`)
    this.name = "QuotaExceededError"
  }
}

// TTLock resets the monthly count on Beijing time, so the local period must
// use UTC+8 or the two counters disagree at the month boundary.
export function ttlockPeriod(now: Date): string {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const year = shifted.getUTCFullYear()
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

export async function recordVendorCall(vendor: string, count = 1, now: Date = new Date()): Promise<void> {
  const period = ttlockPeriod(now)
  await prisma.vendorApiCall.upsert({
    where: { vendor_period: { vendor, period } },
    create: { vendor, period, count },
    update: { count: { increment: count } },
  })
}

export async function readVendorCount(vendor: string, now: Date = new Date()): Promise<number> {
  const row = await prisma.vendorApiCall.findUnique({
    where: { vendor_period: { vendor, period: ttlockPeriod(now) } },
    select: { count: true },
  })
  return row?.count ?? 0
}

export async function checkQuota(input: {
  vendor: string
  kind: QuotaKind
  now?: Date
}): Promise<QuotaStatus> {
  const env = getEnv()
  const limit = env.TTLOCK_MONTHLY_QUOTA
  if (limit <= 0) return "ok"

  let count: number
  try {
    count = await readVendorCount(input.vendor, input.now)
  } catch {
    // The guard protects the vendor quota, not the app's security. A failed
    // count read must not block a resident's unlock.
    return "ok"
  }

  if (count >= limit) return "hard_limited"

  const softLimit = Math.floor((limit * env.TTLOCK_QUOTA_SOFT_LIMIT_PERCENT) / 100)
  if (input.kind !== "command" && count >= softLimit) return "soft_limited"

  return "ok"
}
