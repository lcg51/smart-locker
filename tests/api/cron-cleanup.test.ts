import { beforeEach, describe, expect, it, vi } from "vitest"
import { getEnv } from "@/lib/env"
import { GET } from "@/app/api/cron/cleanup/route"

const mocks = vi.hoisted(() => ({ cleanupExpiredData: vi.fn() }))

vi.mock("@/lib/env", () => ({ getEnv: vi.fn() }))
vi.mock("@/lib/privacy/cleanup", () => ({ cleanupExpiredData: mocks.cleanupExpiredData }))

beforeEach(() => {
  vi.mocked(getEnv).mockReset()
  mocks.cleanupExpiredData.mockReset()
})

function cronRequest(authorization?: string): Request {
  return new Request("http://localhost:3000/api/cron/cleanup", {
    headers: authorization ? { authorization } : {},
  })
}

describe("GET /api/cron/cleanup", () => {
  it("returns 503 when no cron secret is configured", async () => {
    vi.mocked(getEnv).mockReturnValue({ CRON_SECRET: undefined } as ReturnType<typeof getEnv>)

    const response = await GET(cronRequest())

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: "cron_not_configured" })
    expect(mocks.cleanupExpiredData).not.toHaveBeenCalled()
  })

  it("returns 401 for a missing or incorrect bearer token", async () => {
    vi.mocked(getEnv).mockReturnValue({ CRON_SECRET: "a-secret-at-least-16" } as ReturnType<typeof getEnv>)

    const missing = await GET(cronRequest())
    const wrong = await GET(cronRequest("Bearer wrong-secret"))

    expect(missing.status).toBe(401)
    expect(wrong.status).toBe(401)
    expect(mocks.cleanupExpiredData).not.toHaveBeenCalled()
  })

  it("runs the cleanup with a valid bearer token", async () => {
    vi.mocked(getEnv).mockReturnValue({ CRON_SECRET: "a-secret-at-least-16" } as ReturnType<typeof getEnv>)
    mocks.cleanupExpiredData.mockResolvedValue({
      grants: 2,
      sessions: 1,
      verificationTokens: 1,
      lockEvents: 3,
    })

    const response = await GET(cronRequest("Bearer a-secret-at-least-16"))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      grants: 2,
      sessions: 1,
      verificationTokens: 1,
      lockEvents: 3,
    })
    expect(mocks.cleanupExpiredData).toHaveBeenCalledTimes(1)
  })
})
