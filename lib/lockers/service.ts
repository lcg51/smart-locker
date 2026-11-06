import { ActorType, LockAction, LockStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { getLockerForUser } from "@/lib/lockers/queries"
import { getLockProvider } from "@/lib/locks"
import type { LockProvider, LockerState } from "@/lib/locks/types"

export type LockerActionInput = {
  userId: string
  lockerId: string
  provider?: LockProvider
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
  const provider = input.provider ?? await getLockProvider()
  const locker = await getLockerForUser(input.userId, input.lockerId)
  if (!locker) return { ok: false, errorCode: "not_found" }

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
    } catch {
      await recordFailure(locker.id, command, "provider_error")
      return { ok: false, errorCode: "provider_error" }
    }

    if (state.status !== targetStatus) {
      await recordFailure(locker.id, command, "provider_error")
      return { ok: false, errorCode: "provider_error" }
    }
  }

  if (!state) {
    try {
      state = await provider.getState(locker.vendorLockId)
    } catch {
      await recordFailure(locker.id, command, "provider_error")
      return { ok: false, errorCode: "provider_error" }
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

  let state: LockerState
  try {
    state = await provider.getState(locker.vendorLockId)
  } catch {
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
