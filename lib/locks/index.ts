import { decryptSecret, encryptSecret } from "@/lib/crypto"
import { prisma } from "@/lib/db"
import { getEnv } from "@/lib/env"
import { MockLockProvider } from "@/lib/locks/mock"
import { refreshTTLockToken, TTLockClient, TTLockProvider } from "@/lib/locks/ttlock"
import type { TTLockToken } from "@/lib/locks/ttlock"
import type { LockProvider } from "@/lib/locks/types"

export type LockProviderConfig = {
  LOCK_PROVIDER: "mock" | "ttlock"
  TTLOCK_API_URL?: string
  TTLOCK_CLIENT_ID?: string
  TTLOCK_CLIENT_SECRET?: string
  CREDENTIAL_ENCRYPTION_KEY?: string
  fetch?: typeof fetch
}

const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
let warnedRefreshFailure = false

export async function createLockProvider(config: LockProviderConfig): Promise<LockProvider> {
  if (config.LOCK_PROVIDER === "mock") return new MockLockProvider()
  return createTTLockProvider(config)
}

async function createTTLockProvider(config: LockProviderConfig): Promise<LockProvider> {
  const key = config.CREDENTIAL_ENCRYPTION_KEY
  if (!key) throw new Error("CREDENTIAL_ENCRYPTION_KEY is required for the ttlock provider")
  if (!config.TTLOCK_API_URL || !config.TTLOCK_CLIENT_ID) {
    throw new Error("TTLOCK_API_URL and TTLOCK_CLIENT_ID are required for the ttlock provider")
  }

  const credential = await prisma.vendorCredential.findUnique({ where: { vendor: "ttlock" } })
  if (!credential) throw new Error("No TTLock credential is stored; run pnpm seed-ttlock")

  const token = JSON.parse(decryptSecret(credential.encryptedTokens, key)) as TTLockToken
  const accessToken = await currentAccessToken({ token, key, config })

  return new TTLockProvider(
    new TTLockClient({
      baseUrl: config.TTLOCK_API_URL,
      clientId: config.TTLOCK_CLIENT_ID,
      accessToken,
      fetch: config.fetch,
    }),
  )
}

async function currentAccessToken(input: {
  token: TTLockToken
  key: string
  config: LockProviderConfig
}): Promise<string> {
  const expiresAt = Date.parse(input.token.expiresAt ?? "")
  if (!Number.isFinite(expiresAt) || expiresAt - Date.now() > REFRESH_WINDOW_MS) {
    return input.token.accessToken
  }

  const { TTLOCK_API_URL, TTLOCK_CLIENT_ID, TTLOCK_CLIENT_SECRET } = input.config
  if (!input.token.refreshToken || !TTLOCK_API_URL || !TTLOCK_CLIENT_ID || !TTLOCK_CLIENT_SECRET) {
    return input.token.accessToken
  }

  try {
    const refreshed = await refreshTTLockToken(
      {
        baseUrl: TTLOCK_API_URL,
        clientId: TTLOCK_CLIENT_ID,
        clientSecret: TTLOCK_CLIENT_SECRET,
        refreshToken: input.token.refreshToken,
        uid: input.token.uid,
      },
      input.config.fetch,
    )
    const merged: TTLockToken = {
      ...input.token,
      ...refreshed,
      uid: refreshed.uid || input.token.uid,
    }
    await prisma.vendorCredential.update({
      where: { vendor: "ttlock" },
      data: { encryptedTokens: encryptSecret(JSON.stringify(merged), input.key) },
    })
    return merged.accessToken
  } catch {
    if (!warnedRefreshFailure) {
      warnedRefreshFailure = true
      console.warn("TTLock token refresh failed; using the stored token until it is re-seeded")
    }
    return input.token.accessToken
  }
}

const globalForLocks = globalThis as unknown as {
  __smartLockerProvider?: Promise<LockProvider>
}

export function getLockProvider(): Promise<LockProvider> {
  // One provider per process, shared across Next.js route and action bundles:
  // provider-side state (notably the mock lock state) must be visible to later
  // requests.
  globalForLocks.__smartLockerProvider ??= createLockProvider(getEnv())
  return globalForLocks.__smartLockerProvider
}
