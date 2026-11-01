import { describe, expect, it } from "vitest"
import { parseEnv } from "@/lib/env"

const valid = {
  DATABASE_URL: "postgresql://smart:smart@localhost:5432/smart_locker",
  AUTH_SECRET: "a".repeat(32),
  APP_URL: "http://localhost:3000",
  EMAIL_FROM: "no-reply@example.com",
  RESEND_API_KEY: "re_test",
}

describe("parseEnv", () => {
  it("defaults the lock provider to mock", () => {
    expect(parseEnv(valid).LOCK_PROVIDER).toBe("mock")
  })

  it("rejects a short auth secret", () => {
    expect(() => parseEnv({ ...valid, AUTH_SECRET: "short" })).toThrow()
  })

  it("rejects a missing database url", () => {
    const { DATABASE_URL, ...rest } = valid
    expect(() => parseEnv(rest)).toThrow()
  })
})
