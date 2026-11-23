import { beforeEach, describe, expect, it } from "vitest"
import { resolveSignIn } from "@/lib/auth/sign-in-callback"
import { prisma } from "@/lib/db"
import { resetDb } from "@/tests/helpers/db"

const EMAIL = "ana@example.com"

beforeEach(resetDb)

async function allow(email = EMAIL) {
  await prisma.allowedEmail.create({ data: { email } })
  return prisma.user.create({ data: { email } })
}

describe("resolveSignIn", () => {
  it("allows an invited email and records the request locale", async () => {
    const user = await allow()

    await expect(resolveSignIn(EMAIL, async () => "es")).resolves.toBe(true)

    await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
      .resolves.toMatchObject({ locale: "es" })
  })

  it("keeps the stored locale when the locale lookup fails", async () => {
    const user = await allow()

    await expect(resolveSignIn(EMAIL, async () => {
      throw new Error("no request context")
    })).resolves.toBe(true)

    await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
      .resolves.toMatchObject({ locale: "en" })
  })

  it("rejects an email outside the allowlist without touching the locale", async () => {
    const user = await prisma.user.create({ data: { email: "guest@example.com" } })

    await expect(resolveSignIn("guest@example.com", async () => "es"))
      .resolves.toBe("/auth?error=not_invited")

    await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
      .resolves.toMatchObject({ locale: "en" })
  })

  it("rejects a missing email", async () => {
    await expect(resolveSignIn(null, async () => "es"))
      .resolves.toBe("/auth?error=not_invited")
  })
})
