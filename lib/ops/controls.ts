import { getEnv } from "@/lib/env"
import type { Env } from "@/lib/env"

export function isSharingEnabled(env: Env = getEnv()): boolean {
  return env.SHARING_ENABLED
}

export function isLockCommandsEnabled(env: Env = getEnv()): boolean {
  return env.LOCK_COMMANDS_ENABLED
}
