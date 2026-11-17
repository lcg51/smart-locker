import { beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/db"
import { adapter } from "@/lib/auth/adapter"
import { resetDb } from "@/tests/helpers/db"

const mocks = vi.hoisted(() => ({ headers: vi.fn() }))

vi.mock("next/headers", () => ({ headers: mocks.headers }))

beforeEach(async () => {
  mocks.headers.mockReset()
  await resetDb()
})

describe("auth adapter createSession", () => {  it("stores derived device and location labels when creating a session", async () => {
    const user = await prisma.user.create({ data: { email: "ana@example.com" } })
    mocks.headers.mockResolvedValue(new Headers({
      "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      "x-vercel-ip-city": "Madrid",
      "x-vercel-ip-country": "ES",
    }))

    await adapter.createSession!({
      sessionToken: "session-token",
      userId: user.id,
      expires: new Date("2030-01-01T00:00:00.000Z"),
    })

    await expect(prisma.session.findUniqueOrThrow({ where: { sessionToken: "session-token" } }))
      .resolves.toMatchObject({
        deviceLabel: "Safari on iOS",
        locationLabel: "Madrid, ES",
      })
  })

  it("creates the session without a location when geo headers are absent", async () => {
    const user = await prisma.user.create({ data: { email: "ana@example.com" } })
    mocks.headers.mockResolvedValue(new Headers({
      "user-agent": "curl/8.0",
    }))

    await adapter.createSession!({
      sessionToken: "session-token",
      userId: user.id,
      expires: new Date("2030-01-01T00:00:00.000Z"),
    })

    await expect(prisma.session.findUniqueOrThrow({ where: { sessionToken: "session-token" } }))
      .resolves.toMatchObject({
        deviceLabel: "Unknown device",
        locationLabel: null,
      })
  })
})

describe("auth adapter deleteSession", () => {
  it("does not throw when the session was already revoked", async () => {
    await expect(adapter.deleteSession!("already-revoked")).resolves.toBeUndefined()
  })

  it("deletes an existing session", async () => {
    const user = await prisma.user.create({ data: { email: "ana@example.com" } })
    await prisma.session.create({
      data: {
        sessionToken: "session-token",
        userId: user.id,
        expires: new Date("2030-01-01T00:00:00.000Z"),
      },
    })

    await adapter.deleteSession!("session-token")

    await expect(prisma.session.findUnique({ where: { sessionToken: "session-token" } }))
      .resolves.toBeNull()
  })
})
