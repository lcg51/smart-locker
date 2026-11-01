import { getEnv } from "@/lib/env"
import { MockLockProvider } from "@/lib/locks/mock"
import type { LockProvider } from "@/lib/locks/types"

export async function createLockProvider(config: {
  LOCK_PROVIDER: "mock" | "ttlock"
}): Promise<LockProvider> {
  if (config.LOCK_PROVIDER === "mock") return new MockLockProvider()
  throw new Error("ttlock provider is not configured yet")
}

export function getLockProvider(): Promise<LockProvider> {
  return createLockProvider(getEnv())
}
