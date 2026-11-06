import { getEnv } from "@/lib/env"
import { MockLockProvider } from "@/lib/locks/mock"
import type { LockProvider } from "@/lib/locks/types"

export async function createLockProvider(config: {
  LOCK_PROVIDER: "mock" | "ttlock"
}): Promise<LockProvider> {
  if (config.LOCK_PROVIDER === "mock") return new MockLockProvider()
  throw new Error("ttlock provider is not configured yet")
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
