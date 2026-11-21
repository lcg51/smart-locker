import { createHash } from "node:crypto"
import { describe, expect, it, vi } from "vitest"
import { QuotaExceededError } from "@/lib/locks/quota"
import { requestTTLockToken, TTLockClient } from "@/lib/locks/ttlock"

const BASE = "https://euapi.ttlock.com"

function allowAll() {
  return { check: async () => "ok" as const, record: async () => {} }
}

describe("TTLockClient", () => {
  it("posts form-encoded parameters with the client id, token, and millisecond date", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ errcode: 0 }), { status: 200 }))
    const client = new TTLockClient({
      baseUrl: `${BASE}/`,
      clientId: "client-1",
      accessToken: "token-1",
      fetch: fetchMock as unknown as typeof fetch,
      now: () => 1_700_000_000_000,
      quota: allowAll(),
    })

    await client.post("/v3/lock/unlock", { lockId: 42 })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${BASE}/v3/lock/unlock`)
    expect(init.method).toBe("POST")
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/x-www-form-urlencoded")
    const body = new URLSearchParams(init.body as string)
    expect(body.get("clientId")).toBe("client-1")
    expect(body.get("accessToken")).toBe("token-1")
    expect(body.get("lockId")).toBe("42")
    expect(body.get("date")).toBe("1700000000000")
  })

  it("puts the same parameters in the query string for GET", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ errcode: 0, state: 1 }), { status: 200 }))
    const client = new TTLockClient({
      baseUrl: BASE,
      clientId: "client-1",
      accessToken: "token-1",
      fetch: fetchMock as unknown as typeof fetch,
      now: () => 1,
      quota: allowAll(),
    })

    await expect(client.get("/v3/lock/queryOpenState", { lockId: 42 })).resolves.toEqual({ errcode: 0, state: 1 })

    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    const parsed = new URL(url)
    expect(parsed.pathname).toBe("/v3/lock/queryOpenState")
    expect(parsed.searchParams.get("lockId")).toBe("42")
    expect(parsed.searchParams.get("accessToken")).toBe("token-1")
  })

  it("throws on an HTTP error so the provider reports a network error", async () => {
    const client = new TTLockClient({
      baseUrl: BASE,
      clientId: "c",
      accessToken: "t",
      fetch: (async () => new Response("", { status: 503 })) as unknown as typeof fetch,
      quota: allowAll(),
    })
    await expect(client.post("/v3/lock/lock", { lockId: 1 })).rejects.toThrow("HTTP 503")
  })

  it("refuses a call when the guard is hard-limited without reaching the vendor", async () => {
    const fetchMock = vi.fn()
    const client = new TTLockClient({
      baseUrl: BASE,
      clientId: "c",
      accessToken: "t",
      fetch: fetchMock as unknown as typeof fetch,
      quota: { check: async () => "hard_limited" as const, record: async () => {} },
    })

    await expect(client.post("/v3/lock/unlock", { lockId: 1 }, "command")).rejects.toBeInstanceOf(QuotaExceededError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("records a vendor call after a response, including vendor errors", async () => {
    const record = vi.fn(async () => {})
    const client = new TTLockClient({
      baseUrl: BASE,
      clientId: "c",
      accessToken: "t",
      fetch: (async () => new Response(JSON.stringify({ errcode: 30003 }), { status: 200 })) as unknown as typeof fetch,
      quota: { check: async () => "ok" as const, record },
    })

    await client.post("/v3/lock/unlock", { lockId: 1 }, "command")
    expect(record).toHaveBeenCalledTimes(1)
  })
})

describe("requestTTLockToken", () => {
  it("sends the password as lowercase MD5 and returns the token with an expiry", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ access_token: "access-1", refresh_token: "refresh-1", uid: 2340, expires_in: 7_776_000 }),
        { status: 200 },
      ),
    )

    const token = await requestTTLockToken(
      { baseUrl: BASE, clientId: "c", clientSecret: "s", username: "owner@example.com", password: "Secret123" },
      fetchMock as unknown as typeof fetch,
      () => 0,
    )

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${BASE}/oauth2/token`)
    const body = new URLSearchParams(init.body as string)
    expect(body.get("password")).toBe(createHash("md5").update("Secret123").digest("hex"))
    expect(body.get("password")).toMatch(/^[0-9a-f]{32}$/)
    expect(body.get("username")).toBe("owner@example.com")
    expect(token).toEqual({
      accessToken: "access-1",
      refreshToken: "refresh-1",
      uid: 2340,
      expiresAt: new Date(7_776_000 * 1000).toISOString(),
    })
  })

  it("throws with the vendor error code when credentials are refused", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ errcode: 10007 }), { status: 200 }))
    await expect(
      requestTTLockToken(
        { baseUrl: BASE, clientId: "c", clientSecret: "s", username: "u", password: "p" },
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow("10007")
  })
})
