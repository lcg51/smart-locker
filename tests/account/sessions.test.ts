import { beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/db"
import { listActiveSessions, revokeOtherSessions } from "@/lib/auth/session"
import { resetDb } from "@/tests/helpers/db"

vi.mock("@/auth", () => ({ auth: vi.fn() }))

beforeEach(resetDb)

async function seedUser(email: string) {
  return prisma.user.create({ data: { email } })
}

async function seedSession(input: {
  userId: string
  token: string
  expires?: Date
}) {
  return prisma.session.create({
    data: {
      userId: input.userId,
      sessionToken: input.token,
      expires: input.expires ?? new Date("2030-01-01T00:00:00.000Z"),
    },
  })
}

describe("revokeOtherSessions", () => {
  it("revokes every session except the current one", async () => {
    const user = await seedUser("ana@example.com")
    const current = await seedSession({ userId: user.id, token: "current" })
    const other = await seedSession({ userId: user.id, token: "other" })

    await expect(revokeOtherSessions({
      userId: user.id,
      currentToken: current.sessionToken,
    })).resolves.toEqual({ revoked: 1 })

    await expect(prisma.session.findUnique({ where: { id: current.id } })).resolves.not.toBeNull()
    await expect(prisma.session.findUnique({ where: { id: other.id } })).resolves.toBeNull()
  })

  it("does not revoke another resident's sessions", async () => {
    const user = await seedUser("ana@example.com")
    const otherUser = await seedUser("beto@example.com")
    await seedSession({ userId: user.id, token: "ana-other" })
    const otherUserSession = await seedSession({ userId: otherUser.id, token: "beto-session" })

    await expect(revokeOtherSessions({
      userId: user.id,
      currentToken: null,
    })).resolves.toEqual({ revoked: 1 })

    await expect(prisma.session.findUnique({ where: { id: otherUserSession.id } })).resolves.not.toBeNull()
  })

  it("revokes all of the user's sessions when the current token is unknown", async () => {
    const user = await seedUser("ana@example.com")
    await seedSession({ userId: user.id, token: "one" })
    await seedSession({ userId: user.id, token: "two" })

    await expect(revokeOtherSessions({ userId: user.id, currentToken: null }))
      .resolves.toEqual({ revoked: 2 })
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0)
  })
})

describe("listActiveSessions", () => {
  it("lists active sessions newest first and identifies this device", async () => {
    const user = await seedUser("ana@example.com")
    const current = await seedSession({ userId: user.id, token: "current" })
    const other = await seedSession({ userId: user.id, token: "other" })
    const expired = await seedSession({
      userId: user.id,
      token: "expired",
      expires: new Date("2020-01-01T00:00:00.000Z"),
    })
    await prisma.session.update({
      where: { id: current.id },
      data: { createdAt: new Date("2026-11-01T10:00:00.000Z") },
    })
    await prisma.session.update({
      where: { id: other.id },
      data: { createdAt: new Date("2026-11-02T10:00:00.000Z") },
    })

    const sessions = await listActiveSessions(user.id, current.sessionToken)

    expect(sessions.map((session) => session.id)).toEqual([other.id, current.id])
    expect(sessions[0]).toMatchObject({ isCurrent: false })
    expect(sessions[1]).toMatchObject({ isCurrent: true })
    expect(sessions.every((session) => session.id !== expired.id)).toBe(true)
    expect(sessions[0]).not.toHaveProperty("sessionToken")
  })
})
