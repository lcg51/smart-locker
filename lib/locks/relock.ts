import { ActorType, LockAction, LockStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { getLockProvider } from "@/lib/locks"
import type { LockProvider } from "@/lib/locks/types"
import { hashShareToken } from "@/lib/shares/token"

export type RelockResult = { ok: true } | { ok: false; errorCode: string }

export type RelockShareInput = {
  token: string
  provider?: LockProvider
  now?: Date
}

export type RelockDueInput = {
  now?: Date
  provider?: LockProvider
  limit?: number
}

export type RelockDueResult = {
  relocked: number
  failed: number
}

async function lockLocker(input: {
  lockerId: string
  vendorLockId: string
  grantId?: string
  provider: LockProvider
  now: Date
}): Promise<RelockResult> {
  let errorCode: string | null = null

  try {
    const result = await input.provider.lock(input.vendorLockId)
    if (!result.success) errorCode = result.errorCode
  } catch {
    errorCode = "provider_error"
  }

  if (errorCode) {
    await prisma.lockEvent.create({
      data: {
        lockerId: input.lockerId,
        grantId: input.grantId,
        actorType: ActorType.SYSTEM,
        action: LockAction.LOCK,
        success: false,
        errorCode,
        createdAt: input.now,
      },
    })
    return { ok: false, errorCode }
  }

  await prisma.$transaction([
    prisma.locker.update({
      where: { id: input.lockerId },
      data: {
        status: LockStatus.LOCKED,
        relockAt: null,
        lastSyncedAt: input.now,
      },
    }),
    prisma.lockEvent.create({
      data: {
        lockerId: input.lockerId,
        grantId: input.grantId,
        actorType: ActorType.SYSTEM,
        action: LockAction.LOCK,
        success: true,
        createdAt: input.now,
      },
    }),
  ])

  return { ok: true }
}

export async function relockShareToken({
  token,
  provider,
  now = new Date(),
}: RelockShareInput): Promise<RelockResult> {
  const grant = await prisma.shareGrant.findUnique({
    where: { tokenHash: hashShareToken(token) },
    select: {
      id: true,
      locker: {
        select: {
          id: true,
          vendorLockId: true,
          relockAt: true,
        },
      },
    },
  })

  if (!grant) return { ok: false, errorCode: "not_found" }
  if (grant.locker.relockAt === null) return { ok: true }

  const lockProvider = provider ?? await getLockProvider()
  return lockLocker({
    lockerId: grant.locker.id,
    vendorLockId: grant.locker.vendorLockId,
    grantId: grant.id,
    provider: lockProvider,
    now,
  })
}

export async function relockDueLockers({
  now = new Date(),
  provider,
  limit = 50,
}: RelockDueInput = {}): Promise<RelockDueResult> {
  const due = await prisma.locker.findMany({
    where: {
      relockAt: { lte: now },
      deletedAt: null,
    },
    orderBy: { relockAt: "asc" },
    take: limit,
    select: {
      id: true,
      vendorLockId: true,
    },
  })

  if (due.length === 0) return { relocked: 0, failed: 0 }

  const lockProvider = provider ?? await getLockProvider()
  let relocked = 0
  let failed = 0

  for (const locker of due) {
    const result = await lockLocker({
      lockerId: locker.id,
      vendorLockId: locker.vendorLockId,
      provider: lockProvider,
      now,
    })
    if (result.ok) {
      relocked += 1
    } else {
      failed += 1
    }
  }

  return { relocked, failed }
}
