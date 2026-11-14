import { getRateLimiter } from "@/lib/rate-limit"
import type { RateLimiter } from "@/lib/rate-limit"

const TEN_MINUTES_MS = 10 * 60_000

export async function checkMagicLinkRateLimit(input: {
  email: string
  ip: string
  limiter?: RateLimiter
}): Promise<boolean> {
  const limiter = input.limiter ?? getRateLimiter()
  const email = input.email.trim().toLowerCase()
  const ip = input.ip.trim() || "unknown"

  const emailAllowed = await limiter.check(`auth:email:${email}`, 5, TEN_MINUTES_MS)
  if (!emailAllowed) return false

  return limiter.check(`auth:ip:${ip}`, 20, TEN_MINUTES_MS)
}
