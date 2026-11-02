import { beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { provisionApartment } from "@/lib/ops/provision"
import { createShareGrant } from "@/lib/shares/service"
import { resolveShareToken } from "@/lib/shares/redeem"
import { deleteAccount } from "@/lib/account/delete"
import { resetDb } from "@/tests/helpers/db"

beforeEach(resetDb)

async function seed(email = "ana@example.com") {
  const { userId } = await provisionApartment({
    email,
    gatewayId: `gateway-${email}`,
    lockers: [{ name: "Kitchen", vendor: "mock", vendorLockId: `lock-${email}` }],
  })
  const locker = await prisma.locker.findFirstOrThrow({ where: { userId } })
  return { userId, locker }
}

describe("deleteAccount", () => {
  it("hard-deletes account data and invalidates outstanding share links", async () => {
    const { userId, locker } = await seed()
    const { token } = await createShareGrant({ userId, lockerId: locker.id })
    await prisma.session.create({
      data: { sessionToken: "session-1", userId, expires: new Date(Date.now() + 60_000) },
    })
    await prisma.account.create({
      data: { userId, type: "oauth", provider: "google", providerAccountId: "ana-google" },
    })
    await prisma.lockEvent.create({
      data: { lockerId: locker.id, actorType: "OWNER", action: "UNLOCK", success: true },
    })
    await prisma.verificationToken.create({
      data: { identifier: "ana@example.com", token: "verification-1", expires: new Date(Date.now() + 60_000) },
    })

    await deleteAccount(userId)

    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull()
    expect(await prisma.locker.count({ where: { userId } })).toBe(0)
    expect(await prisma.shareGrant.count({ where: { createdByUserId: userId } })).toBe(0)
    expect(await prisma.lockEvent.count({ where: { lockerId: locker.id } })).toBe(0)
    expect(await prisma.session.count({ where: { userId } })).toBe(0)
    expect(await prisma.account.count({ where: { userId } })).toBe(0)
    expect(await prisma.allowedEmail.count({ where: { email: "ana@example.com" } })).toBe(0)
    expect(await prisma.verificationToken.count({ where: { identifier: "ana@example.com" } })).toBe(0)
    await expect(resolveShareToken(token)).resolves.toEqual({ ok: false, reason: "not_found" })
  })

  it("preserves other residents and platform-level vendor credentials", async () => {
    const owner = await seed()
    const other = await seed("other@example.com")
    await prisma.lockEvent.create({
      data: { lockerId: other.locker.id, actorType: "OWNER", action: "LOCK", success: true },
    })
    const credential = await prisma.vendorCredential.create({
      data: { vendor: "ttlock", encryptedTokens: "encrypted-platform-credential" },
    })

    await deleteAccount(owner.userId)

    expect(await prisma.user.findUnique({ where: { id: other.userId } })).not.toBeNull()
    expect(await prisma.locker.count({ where: { userId: other.userId } })).toBe(1)
    expect(await prisma.lockEvent.count({ where: { lockerId: other.locker.id } })).toBe(1)
    expect(await prisma.vendorCredential.findUnique({ where: { id: credential.id } })).not.toBeNull()
  })
})
