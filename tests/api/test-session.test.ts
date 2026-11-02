import { beforeEach, describe, expect, it, vi } from "vitest"
import { getEnv } from "@/lib/env"
import { prisma } from "@/lib/db"
import { provisionApartment } from "@/lib/ops/provision"
import { POST } from "@/app/api/test/session/route"
import { resetDb } from "@/tests/helpers/db"

const mocks = vi.hoisted(() => ({ cookieSet: vi.fn() }))

vi.mock("@/lib/env", () => ({ getEnv: vi.fn() }))
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mocks.cookieSet }),
}))

beforeEach(async () => {
  vi.mocked(getEnv).mockReset()
  mocks.cookieSet.mockReset()
  await resetDb()
})

function sessionRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/test/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/test/session", () => {
  it("returns 404 for a known resident when E2E mode is not enabled", async () => {
    await provisionApartment({
      email: "ana@example.com",
      gatewayId: "gw-gate",
      lockers: [{ name: "Kitchen", vendor: "mock", vendorLockId: "gate-lock-1" }],
    })
    vi.mocked(getEnv).mockReturnValue({ E2E: undefined } as ReturnType<typeof getEnv>)

    await expect(POST(sessionRequest({ email: "ana@example.com" }))).resolves.toMatchObject({ status: 404 })
    expect(await prisma.session.count()).toBe(0)
    expect(mocks.cookieSet).not.toHaveBeenCalled()
  })

  it("returns 404 for unknown users and creates no session", async () => {
    vi.mocked(getEnv).mockReturnValue({ E2E: "1" } as ReturnType<typeof getEnv>)

    await expect(POST(sessionRequest({ email: "missing@example.com" }))).resolves.toMatchObject({ status: 404 })
    expect(await prisma.session.count()).toBe(0)
    expect(mocks.cookieSet).not.toHaveBeenCalled()
  })

  it("creates a database session and sets the session cookie for a known resident", async () => {
    vi.mocked(getEnv).mockReturnValue({ E2E: "1" } as ReturnType<typeof getEnv>)
    await provisionApartment({
      email: "ana@example.com",
      gatewayId: "gw-unit",
      lockers: [{ name: "Kitchen", vendor: "mock", vendorLockId: "unit-lock-1" }],
    })

    const response = await POST(sessionRequest({ email: "ANA@example.com" }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    const sessions = await prisma.session.findMany()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].sessionToken).toMatch(/^[0-9a-f]{64}$/)
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      "authjs.session-token",
      sessions[0].sessionToken,
      expect.objectContaining({
        httpOnly: true,
        path: "/",
        sameSite: "lax",
      }),
    )
  })
})
