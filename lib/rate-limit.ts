import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { getEnv } from "@/lib/env"

export interface RateLimiter {
  check(key: string, limit: number, windowMs: number): Promise<boolean>
}

type Window = { count: number; resetAt: number }

export function createInMemoryRateLimiter(now: () => number = Date.now): RateLimiter {
  const windows = new Map<string, Window>()
  let checks = 0

  return {
    async check(key, limit, windowMs) {
      if (!Number.isInteger(limit) || limit < 1 || !Number.isFinite(windowMs) || windowMs < 1) {
        return false
      }

      const currentTime = now()
      const current = windows.get(key)
      if (!current || current.resetAt <= currentTime) {
        windows.set(key, { count: 1, resetAt: currentTime + windowMs })
        checks += 1
        if (checks % 256 === 0) {
          for (const [windowKey, window] of windows) {
            if (window.resetAt <= currentTime) windows.delete(windowKey)
          }
        }
        return true
      }

      if (current.count >= limit) return false
      current.count += 1
      return true
    },
  }
}

let sharedRedis: Redis | undefined
const upstashLimiters = new Map<string, Ratelimit>()
let defaultLimiter: RateLimiter | undefined

export function getRateLimiter(): RateLimiter {
  if (defaultLimiter) return defaultLimiter

  const env = getEnv()
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    defaultLimiter = createInMemoryRateLimiter()
    return defaultLimiter
  }

  sharedRedis = Redis.fromEnv()
  defaultLimiter = {
    async check(key, limit, windowMs) {
      if (!Number.isInteger(limit) || limit < 1 || !Number.isFinite(windowMs) || windowMs < 1) {
        return false
      }

      const configKey = `${limit}:${windowMs}`
      let rateLimit = upstashLimiters.get(configKey)
      if (!rateLimit) {
        rateLimit = new Ratelimit({
          redis: sharedRedis!,
          limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
          prefix: "smart-locker:share",
        })
        upstashLimiters.set(configKey, rateLimit)
      }
      const result = await rateLimit.limit(key)
      return result.success
    },
  }
  return defaultLimiter
}
