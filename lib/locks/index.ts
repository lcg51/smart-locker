import { decryptSecret } from "@/lib/crypto"
import { prisma } from "@/lib/db"
import { getEnv } from "@/lib/env"
import { MockLockProvider } from "@/lib/locks/mock"
import { TTLockClient, TTLockProvider } from "@/lib/locks/ttlock"
import type { LockProvider } from "@/lib/locks/types"

export type LockProviderConfig = {
  LOCK_PROVIDER: "mock" | "ttlock"
  TTLOCK_API_URL?: string
  TTLOCK_CLIENT_ID?: string
  CREDENTIAL_ENCRYPTION_KEY?: string
}

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

  const { accessToken } = JSON.parse(decryptSecret(credential.encryptedTokens, key)) as { accessToken: string }
  return new TTLockProvider(
    new TTLockClient({
      baseUrl: config.TTLOCK_API_URL,
      clientId: config.TTLOCK_CLIENT_ID,
      accessToken,
    }),
  )
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
