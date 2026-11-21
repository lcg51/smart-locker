import { ActorType, LockAction, LockStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { getLockerForUser } from "@/lib/lockers/queries"
import { getEnv } from "@/lib/env"
import { getLockProvider } from "@/lib/locks"
import { QuotaExceededError } from "@/lib/locks/quota"
import type { LockProvider, LockerState } from "@/lib/locks/types"
import { isLockCommandsEnabled } from "@/lib/ops/controls"
import { getRateLimiter } from "@/lib/rate-limit"
import type { RateLimiter } from "@/lib/rate-limit"

export type LockerActionInput = {
  userId: string
  lockerId: string
  provider?: LockProvider
  limiter?: RateLimiter
}

export type LockerActionResult = {
  ok: boolean
  errorCode?: string
  state?: LockerState
}

export async function renameLocker(input: {
  userId: string
  lockerId: string
  name: string
}): Promise<boolean> {
  const name = input.name.trim()
  if (name.length < 1 || name.length > 40) return false

  const result = await prisma.locker.updateMany({
    where: { id: input.lockerId, userId: input.userId, deletedAt: null },
    data: { name },
  })
  return result.count === 1
}

export async function confirmLocker(input: {
  userId: string
  lockerId: string
}): Promise<boolean> {
  const result = await prisma.locker.updateMany({
    where: { id: input.lockerId, userId: input.userId, deletedAt: null },
    data: { confirmedAt: new Date() },
  })
  return result.count === 1
}

type Command = "unlock" | "lock"

function statusToDbStatus(status: LockerState["status"]): LockStatus {
  if (status === "locked") return LockStatus.LOCKED
  if (status === "unlocked") return LockStatus.UNLOCKED
  return LockStatus.UNKNOWN
}

function dbStatusToState(status: LockStatus): LockerState["status"] {
  if (status === LockStatus.LOCKED) return "locked"
  if (status === LockStatus.UNLOCKED) return "unlocked"
  return "unknown"
}

async function recordFailure(lockerId: string, command: Command, errorCode: string): Promise<void> {
  await prisma.lockEvent.create({
    data: {
      lockerId,
      actorType: ActorType.OWNER,
      action: command === "unlock" ? LockAction.UNLOCK : LockAction.LOCK,
      success: false,
      errorCode,
    },
  })
}

async function recordSuccess(
  lockerId: string,
  command: Command,
  state: LockerState,
): Promise<void> {
  await prisma.$transaction([
    prisma.locker.update({
      where: { id: lockerId },
      data: {
        status: statusToDbStatus(state.status),
        batteryLevel: state.batteryLevel,
        lastSyncedAt: new Date(),
        relockAt: null,
      },
    }),
    prisma.lockEvent.create({
      data: {
        lockerId,
        actorType: ActorType.OWNER,
        action: command === "unlock" ? LockAction.UNLOCK : LockAction.LOCK,
        success: true,
      },
    }),
  ])
}

async function runLockCommand(input: LockerActionInput, command: Command): Promise<LockerActionResult> {
  const locker = await getLockerForUser(input.userId, input.lockerId)
  if (!locker) return { ok: false, errorCode: "not_found" }

  if (command === "unlock" && !isLockCommandsEnabled()) {
    return { ok: false, errorCode: "commands_disabled" }
  }

  const limiter = input.limiter ?? getRateLimiter()
  const allowed = await limiter.check(`lock:user:${input.userId}`, 30, 60_000)
  if (!allowed) return { ok: false, errorCode: "rate_limited" }

  const provider = input.provider ?? await getLockProvider()
  const targetStatus = command === "unlock" ? "unlocked" : "locked"
  let state: LockerState | undefined

  try {
    const result = command === "unlock"
      ? await provider.unlock(locker.vendorLockId)
      : await provider.lock(locker.vendorLockId)

    if (!result.success) {
      await recordFailure(locker.id, command, result.errorCode)
      return { ok: false, errorCode: result.errorCode }
    }
  } catch {
    try {
      state = await provider.getState(locker.vendorLockId)
    } catch (error) {
      const errorCode = error instanceof QuotaExceededError ? "quota_exceeded" : "provider_error"
      await recordFailure(locker.id, command, errorCode)
      return { ok: false, errorCode }
    }

    if (state.status !== targetStatus) {
      await recordFailure(locker.id, command, "provider_error")
      return { ok: false, errorCode: "provider_error" }
    }
  }

  if (!state) {
    try {
      state = await provider.getState(locker.vendorLockId)
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        // The command itself succeeded; only the confirmation read is blocked.
        // Report the state the vendor accepted rather than a false failure.
        state = { status: targetStatus, batteryLevel: null, online: null }
      } else {
        await recordFailure(locker.id, command, "provider_error")
        return { ok: false, errorCode: "provider_error" }
      }
    }
  }

  await recordSuccess(locker.id, command, state)
  return { ok: true, state }
}

export function unlockLockerForUser(input: LockerActionInput): Promise<LockerActionResult> {
  return runLockCommand(input, "unlock")
}

export function lockLockerForUser(input: LockerActionInput): Promise<LockerActionResult> {
  return runLockCommand(input, "lock")
}

export async function refreshLockerState(input: LockerActionInput): Promise<LockerActionResult> {
  const provider = input.provider ?? await getLockProvider()
  const locker = await getLockerForUser(input.userId, input.lockerId)
  if (!locker) return { ok: false, errorCode: "not_found" }

  const cacheMs = getEnv().LOCK_STATE_CACHE_SECONDS * 1000
  if (
    cacheMs > 0 &&
    locker.lastSyncedAt !== null &&
    locker.status !== LockStatus.UNKNOWN &&
    Date.now() - locker.lastSyncedAt.getTime() < cacheMs
  ) {
    return {
      ok: true,
      state: {
        status: dbStatusToState(locker.status),
        batteryLevel: locker.batteryLevel,
        online: null,
      },
    }
  }

  let state: LockerState
  try {
    state = await provider.getState(locker.vendorLockId)
  } catch (error) {
    if (error instanceof QuotaExceededError) return { ok: false, errorCode: "quota_exceeded" }
    return { ok: false, errorCode: "provider_error" }
  }

  await prisma.locker.update({
    where: { id: locker.id },
    data: {
      status: statusToDbStatus(state.status),
      batteryLevel: state.batteryLevel,
      lastSyncedAt: new Date(),
    },
  })

  return { ok: true, state }
}
