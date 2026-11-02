import { describe, expect, it } from "vitest"
import { assertTestDatabaseUrl } from "@/lib/test-db-guard"

describe("assertTestDatabaseUrl", () => {
  it("accepts a database whose name ends with _test", () => {
    expect(() => assertTestDatabaseUrl("postgresql://smart:smart@localhost:5432/smart_locker_test")).not.toThrow()
  })

  it("rejects development, production, and missing database URLs", () => {
    expect(() => assertTestDatabaseUrl("postgresql://smart:smart@localhost:5432/smart_locker")).toThrow("_test")
    expect(() => assertTestDatabaseUrl("postgresql://smart:smart@localhost:5432/pilot")).toThrow("_test")
    expect(() => assertTestDatabaseUrl(undefined)).toThrow("DATABASE_URL")
  })

  it("rejects a malformed URL", () => {
    expect(() => assertTestDatabaseUrl("not-a-url")).toThrow("DATABASE_URL")
  })
})
