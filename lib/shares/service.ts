import { ActorType, ShareAction } from "@prisma/client"
import type { ShareGrant } from "@prisma/client"
import { prisma } from "@/lib/db"
import { getLockerForUser } from "@/lib/lockers/queries"
import { isSharingEnabled } from "@/lib/ops/controls"
import { getRateLimiter } from "@/lib/rate-limit"
import type { RateLimiter } from "@/lib/rate-limit"
import { generateShareToken, hashShareToken } from "@/lib/shares/token"

export type ShareLimitCode = "rate_limited" | "share_limit_reached" | "sharing_disabled"

export class ShareLimitError extends Error {
  readonly code: ShareLimitCode

  constructor(code: ShareLimitCode) {
    super(code)
    this.name = "ShareLimitError"
    this.code = code
  }
}

export type CreateShareInput = {
  userId: string
  lockerId: string
  durationMinutes?: number
  maxUses?: number
  guestLabel?: string
  limiter?: RateLimiter
  now?: Date
}

export type ActiveShareGrant = Pick<ShareGrant, "id" | "guestLabel" | "expiresAt" | "maxUses" | "usedCount">

export async function createShareGrant(
  input: CreateShareInput,
): Promise<{ token: string; grant: ShareGrant }> {
  const durationMinutes = input.durationMinutes ?? 60
  const maxUses = input.maxUses ?? 5

  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 1440) {
    throw new Error("invalid_duration")
  }
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 50) {
    throw new Error("invalid_max_uses")
  }

  const locker = await getLockerForUser(input.userId, input.lockerId)
  if (!locker) throw new Error("locker_not_found")

  if (!isSharingEnabled()) throw new ShareLimitError("sharing_disabled")

  const now = input.now ?? new Date()
  const limiter = input.limiter ?? getRateLimiter()
  const allowed = await limiter.check(`share:create:user:${input.userId}`, 10, 60 * 60_000)
  if (!allowed) throw new ShareLimitError("rate_limited")

  const activeGrants = await prisma.shareGrant.count({
    where: {
      lockerId: locker.id,
      createdByUserId: input.userId,
      revokedAt: null,
      expiresAt: { gt: now },
    },
  })
  if (activeGrants >= 20) throw new ShareLimitError("share_limit_reached")

  const token = generateShareToken()
  const createdAt = now
  const expiresAt = new Date(createdAt.getTime() + durationMinutes * 60_000)
  const grant = await prisma.$transaction(async (tx) => {
    const created = await tx.shareGrant.create({
      data: {
        lockerId: locker.id,
        createdByUserId: input.userId,
        tokenHash: hashShareToken(token),
        guestLabel: input.guestLabel?.trim() || null,
        expiresAt,
        maxUses,
        createdAt,
      },
    })
    await tx.shareGrantEvent.create({
      data: {
        grantId: created.id,
        actorType: ActorType.OWNER,
        action: ShareAction.CREATED,
        detail: `${durationMinutes} minutes, ${maxUses} uses`,
        createdAt,
      },
    })
    return created
  })

  return { token, grant }
}

export async function revokeShareGrant(input: {
  userId: string
  grantId: string
}): Promise<boolean> {
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.shareGrant.updateMany({
      where: {
        id: input.grantId,
        createdByUserId: input.userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    })

    if (updated.count === 1) {
      await tx.shareGrantEvent.create({
        data: {
          grantId: input.grantId,
          actorType: ActorType.OWNER,
          action: ShareAction.REVOKED,
        },
      })
    }

    return updated
  })

  return result.count === 1
}

export function listActiveGrants(input: {
  userId: string
  lockerId: string
}) {
  return prisma.shareGrant.findMany({
    where: {
      lockerId: input.lockerId,
      createdByUserId: input.userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      guestLabel: true,
      expiresAt: true,
      maxUses: true,
      usedCount: true,
    },
  })
}

export type ShareHistoryEvent = {
  id: string
  action: ShareAction
  detail: string | null
  createdAt: Date
  grant: { guestLabel: string | null }
}

export async function listShareHistory(input: {
  userId: string
  lockerId: string
  limit?: number
}): Promise<ShareHistoryEvent[]> {
  const requestedLimit = input.limit ?? 20
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(100, Math.max(1, Math.trunc(requestedLimit)))
    : 20

  return prisma.shareGrantEvent.findMany({
    where: {
      grant: {
        lockerId: input.lockerId,
        locker: { userId: input.userId },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      action: true,
      detail: true,
      createdAt: true,
      grant: { select: { guestLabel: true } },
    },
  })
}

export type ExtendShareInput = {
  userId: string
  grantId: string
  additionalMinutes?: number
  additionalUses?: number
  now?: Date
}

export type ExtendShareResult =
  | { ok: true; grant: ShareGrant }
  | { ok: false; error: "not_found" | "revoked" | "expired" | "invalid_extension" }

export async function extendShareGrant(input: ExtendShareInput): Promise<ExtendShareResult> {
  const now = input.now ?? new Date()
  const additionalMinutes = input.additionalMinutes
  const additionalUses = input.additionalUses

  if (
    additionalMinutes !== undefined
    && (!Number.isInteger(additionalMinutes) || additionalMinutes < 1)
  ) {
    return { ok: false, error: "invalid_extension" }
  }
  if (
    additionalUses !== undefined
    && (!Number.isInteger(additionalUses) || additionalUses < 1)
  ) {
    return { ok: false, error: "invalid_extension" }
  }
  if (additionalMinutes === undefined && additionalUses === undefined) {
    return { ok: false, error: "invalid_extension" }
  }

  const grant = await prisma.shareGrant.findFirst({
    where: {
      id: input.grantId,
      createdByUserId: input.userId,
      locker: { userId: input.userId },
    },
    select: {
      id: true,
      lockerId: true,
      expiresAt: true,
      maxUses: true,
      usedCount: true,
      revokedAt: true,
    },
  })

  if (!grant) return { ok: false, error: "not_found" }
  if (grant.revokedAt) return { ok: false, error: "revoked" }
  if (grant.expiresAt <= now) return { ok: false, error: "expired" }

  const baseExpiry = Math.max(grant.expiresAt.getTime(), now.getTime())
  const newExpiresAt = additionalMinutes === undefined
    ? grant.expiresAt
    : new Date(Math.min(
      baseExpiry + additionalMinutes * 60_000,
      now.getTime() + 1440 * 60_000,
    ))

  const baseMaxUses = Math.max(grant.maxUses, grant.usedCount)
  const newMaxUses = Math.min(50, baseMaxUses + (additionalUses ?? 0))

  const detailParts: string[] = []
  const appliedMinutes = Math.round((newExpiresAt.getTime() - baseExpiry) / 60_000)
  const appliedUses = newMaxUses - baseMaxUses
  if (additionalMinutes !== undefined && appliedMinutes > 0) {
    detailParts.push(`+${appliedMinutes} minutes`)
  }
  if (additionalUses !== undefined && appliedUses > 0) {
    detailParts.push(`+${appliedUses} uses`)
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.shareGrant.update({
      where: { id: grant.id },
      data: {
        expiresAt: newExpiresAt,
        maxUses: newMaxUses,
      },
    })
    await tx.shareGrantEvent.create({
      data: {
        grantId: grant.id,
        actorType: ActorType.OWNER,
        action: ShareAction.EXTENDED,
        detail: detailParts.length > 0 ? detailParts.join(", ") : "No change",
        createdAt: now,
      },
    })
    return result
  })

  return { ok: true, grant: updated }
}
