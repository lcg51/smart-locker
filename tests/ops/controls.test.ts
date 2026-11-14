import { describe, expect, it } from "vitest"
import { parseEnv } from "@/lib/env"
import { isLockCommandsEnabled, isSharingEnabled } from "@/lib/ops/controls"

const validEnv = {
  DATABASE_URL: "postgresql://smart:smart@localhost:5432/smart_locker",
  AUTH_SECRET: "a".repeat(32),
  APP_URL: "http://localhost:3000",
  EMAIL_FROM: "no-reply@example.com",
  RESEND_API_KEY: "re_test",
  PRIVACY_CONTACT_EMAIL: "privacy@example.com",
}

describe("isSharingEnabled", () => {
  it("defaults to enabled", () => {
    expect(isSharingEnabled(parseEnv(validEnv))).toBe(true)
  })

  it("blocks sharing only when SHARING_ENABLED is false", () => {
    expect(isSharingEnabled(parseEnv({ ...validEnv, SHARING_ENABLED: "false" }))).toBe(false)
    expect(isSharingEnabled(parseEnv({ ...validEnv, SHARING_ENABLED: "true" }))).toBe(true)
  })
})

describe("isLockCommandsEnabled", () => {
  it("defaults to enabled", () => {
    expect(isLockCommandsEnabled(parseEnv(validEnv))).toBe(true)
  })

  it("blocks unlock commands only when LOCK_COMMANDS_ENABLED is false", () => {
    expect(isLockCommandsEnabled(parseEnv({ ...validEnv, LOCK_COMMANDS_ENABLED: "false" }))).toBe(false)
    expect(isLockCommandsEnabled(parseEnv({ ...validEnv, LOCK_COMMANDS_ENABLED: "true" }))).toBe(true)
  })
})
