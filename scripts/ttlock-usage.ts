import { prisma } from "@/lib/db"
import { getEnv } from "@/lib/env"
import { readVendorCount, ttlockPeriod } from "@/lib/locks/quota"

async function main(): Promise<void> {
  const env = getEnv()
  if (!env.TTLOCK_API_URL || !env.TTLOCK_CLIENT_ID || !env.TTLOCK_CLIENT_SECRET) {
    throw new Error("TTLOCK_API_URL, TTLOCK_CLIENT_ID, and TTLOCK_CLIENT_SECRET are required")
  }

  const response = await fetch(`${env.TTLOCK_API_URL.replace(/\/$/, "")}/app/getMonthRequestCount`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      clientId: env.TTLOCK_CLIENT_ID,
      clientSecret: env.TTLOCK_CLIENT_SECRET,
    }),
  })
  const json = (await response.json()) as {
    monthRequestCount?: unknown
    errcode?: unknown
    errmsg?: unknown
  }

  if (typeof json.monthRequestCount !== "number") {
    throw new Error(`TTLock usage request failed: ${String(json.errcode ?? response.status)} ${String(json.errmsg ?? "")}`)
  }

  const local = await readVendorCount("ttlock")
  const quota = env.TTLOCK_MONTHLY_QUOTA

  console.log(`Period: ${ttlockPeriod(new Date())} (TTLock uses UTC+8)`)
  console.log(`TTLock month request count: ${json.monthRequestCount}`)
  console.log(`Local counted calls: ${local}`)
  console.log(`Configured limit: ${quota > 0 ? quota : "not set (guard off)"}`)
  console.log(`Soft limit: ${env.TTLOCK_QUOTA_SOFT_LIMIT_PERCENT}%`)
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
