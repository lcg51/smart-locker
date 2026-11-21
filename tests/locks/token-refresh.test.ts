import { beforeEach, describe, expect, it, vi } from "vitest"
import { decryptSecret } from "@/lib/crypto"
import { prisma } from "@/lib/db"
import { createLockProvider } from "@/lib/locks"
import { resetDb } from "@/tests/helpers/db"

const KEY = "a".repeat(64)
const BASE = "https://euapi.ttlock.com"

beforeEach(async () => {
  await resetDb()
})

async function seedCredential(token: Record<string, unknown>) {
  const { encryptSecret } = await import("@/lib/crypto")
  await prisma.vendorCredential.create({
    data: { vendor: "ttlock", encryptedTokens: encryptSecret(JSON.stringify(token), KEY) },
  })
}

async function storedToken() {
  const row = await prisma.vendorCredential.findUniqueOrThrow({ where: { vendor: "ttlock" } })
  return JSON.parse(decryptSecret(row.encryptedTokens, KEY)) as Record<string, unknown>
}

describe("TTLock token refresh", () => {
  it("refreshes a token that expires within a week and stores the new one", async () => {
    await seedCredential({
      accessToken: "old-token",
      refreshToken: "refresh-1",
      uid: 2340,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ access_token: "new-token", refresh_token: "refresh-2", expires_in: 7_776_000 }),
        { status: 200 },
      ),
    )

    await createLockProvider({
      LOCK_PROVIDER: "ttlock",
      TTLOCK_API_URL: BASE,
      TTLOCK_CLIENT_ID: "client-1",
      TTLOCK_CLIENT_SECRET: "secret-1",
      CREDENTIAL_ENCRYPTION_KEY: KEY,
      fetch: fetchMock as unknown as typeof fetch,
    })

    const body = new URLSearchParams((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.get("grant_type")).toBe("refresh_token")
    expect(body.get("refresh_token")).toBe("refresh-1")
    expect(body.get("clientSecret")).toBe("secret-1")

    const stored = await storedToken()
    expect(stored.accessToken).toBe("new-token")
    expect(stored.refreshToken).toBe("refresh-2")
    expect(stored.uid).toBe(2340)
  })

  it("keeps the current token when it is not close to expiry", async () => {
    await seedCredential({
      accessToken: "old-token",
      refreshToken: "refresh-1",
      uid: 2340,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })

    const fetchMock = vi.fn()

    await createLockProvider({
      LOCK_PROVIDER: "ttlock",
      TTLOCK_API_URL: BASE,
      TTLOCK_CLIENT_ID: "client-1",
      TTLOCK_CLIENT_SECRET: "secret-1",
      CREDENTIAL_ENCRYPTION_KEY: KEY,
      fetch: fetchMock as unknown as typeof fetch,
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect((await storedToken()).accessToken).toBe("old-token")
  })

  it("keeps the current token when the refresh call fails", async () => {
    await seedCredential({
      accessToken: "old-token",
      refreshToken: "refresh-1",
      uid: 2340,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ errcode: 10004 }), { status: 200 }))

    await createLockProvider({
      LOCK_PROVIDER: "ttlock",
      TTLOCK_API_URL: BASE,
      TTLOCK_CLIENT_ID: "client-1",
      TTLOCK_CLIENT_SECRET: "secret-1",
      CREDENTIAL_ENCRYPTION_KEY: KEY,
      fetch: fetchMock as unknown as typeof fetch,
    })

    expect((await storedToken()).accessToken).toBe("old-token")
  })
})
