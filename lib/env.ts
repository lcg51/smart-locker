import { z } from "zod"

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url().optional(),
  APP_URL: z.string().url(),
  EMAIL_FROM: z.string().email(),
  RESEND_API_KEY: z.string().min(1),
  PRIVACY_CONTACT_EMAIL: z.string().email(),
  LOCK_PROVIDER: z.enum(["mock", "ttlock"]).default("mock"),
  TTLOCK_API_URL: z.string().url().optional(),
  TTLOCK_CLIENT_ID: z.string().optional(),
  TTLOCK_CLIENT_SECRET: z.string().optional(),
  TTLOCK_MAIL: z.string().optional(),
  TTLOCK_PASSWORD: z.string().optional(),
  CREDENTIAL_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  RELOCK_SECONDS: z.coerce.number().int().min(1).max(3600).default(30),
  CRON_SECRET: z.string().min(16).optional(),
  SHARING_ENABLED: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
  LOCK_COMMANDS_ENABLED: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
  E2E: z.enum(["1"]).optional(),
})

export type Env = z.infer<typeof envSchema>

export function parseEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(source)
}

let cached: Env | null = null

export function getEnv(): Env {
  cached ??= parseEnv(process.env)
  return cached
}

export function resetEnvCacheForTests(): void {
  cached = null
}
