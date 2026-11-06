import { beforeEach, describe, expect, it, vi } from "vitest"
import { getEnv } from "@/lib/env"
import { GET } from "@/app/api/cron/relock/route"

const mocks = vi.hoisted(() => ({ relockDueLockers: vi.fn() }))

vi.mock("@/lib/env", () => ({ getEnv: vi.fn() }))
vi.mock("@/lib/locks/relock", () => ({ relockDueLockers: mocks.relockDueLockers }))

beforeEach(() => {
  vi.mocked(getEnv).mockReset()
  mocks.relockDueLockers.mockReset()
})

function cronRequest(authorization?: string): Request {
  return new Request("http://localhost:3000/api/cron/relock", {
    headers: authorization ? { authorization } : {},
  })
}

describe("GET /api/cron/relock", () => {
  it("returns 503 when no cron secret is configured", async () => {
    vi.mocked(getEnv).mockReturnValue({ CRON_SECRET: undefined } as ReturnType<typeof getEnv>)

    const response = await GET(cronRequest())

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: "cron_not_configured" })
    expect(mocks.relockDueLockers).not.toHaveBeenCalled()
  })

  it("returns 401 for a missing or incorrect bearer token", async () => {
    vi.mocked(getEnv).mockReturnValue({ CRON_SECRET: "a-secret-at-least-16" } as ReturnType<typeof getEnv>)

    const missing = await GET(cronRequest())
    const wrong = await GET(cronRequest("Bearer wrong-secret"))

    expect(missing.status).toBe(401)
    expect(wrong.status).toBe(401)
    expect(mocks.relockDueLockers).not.toHaveBeenCalled()
  })

  it("runs the sweep with a valid bearer token", async () => {
    vi.mocked(getEnv).mockReturnValue({ CRON_SECRET: "a-secret-at-least-16" } as ReturnType<typeof getEnv>)
    mocks.relockDueLockers.mockResolvedValue({ relocked: 2, failed: 1 })

    const response = await GET(cronRequest("Bearer a-secret-at-least-16"))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ relocked: 2, failed: 1 })
    expect(mocks.relockDueLockers).toHaveBeenCalledTimes(1)
  })
})
