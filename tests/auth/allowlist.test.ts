import { beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { isEmailAllowed } from "@/lib/auth/allowlist"
import { resetDb } from "@/tests/helpers/db"

beforeEach(resetDb)

describe("isEmailAllowed", () => {
  it("accepts an invited email case-insensitively", async () => {
    await prisma.allowedEmail.create({ data: { email: "ana@example.com" } })
    await expect(isEmailAllowed(" Ana@Example.com ")).resolves.toBe(true)
  })

  it("rejects an email that is not on the allowlist", async () => {
    await expect(isEmailAllowed("stranger@example.com")).resolves.toBe(false)
  })
})
