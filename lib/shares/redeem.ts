import { createHash } from "node:crypto"
import { ActorType, LockAction, LockStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { sendGuestUnlockEmail } from "@/lib/email"
import { getLockProvider } from "@/lib/locks"
import type { LockProvider } from "@/lib/locks/types"
import { getRateLimiter } from "@/lib/rate-limit"
import type { RateLimiter } from "@/lib/rate-limit"
import { hashShareToken } from "@/lib/shares/token"
import type { GuestUnlockEmailInput, GuestUnlockEmailSender } from "@/lib/email"

export type GrantFailure = {
  ok: false
  reason: "not_found" | "revoked" | "expired" | "exhausted"
}

type ResolvedGrantData = {
  id: string
  guestLabel: string | null
  expiresAt: Date
  maxUses: number
  usedCount: number
  locker: {
    id: string
    name: string
    vendorLockId: string
    user: {
      email: string | null
      guestUnlockEmails: boolean
    }
  }
}

export type ResolvedGrant = { ok: true; grant: ResolvedGrantData }

export type RedeemResult =
  | { ok: true }
  | { ok: false; reason: GrantFailure["reason"] | "rate_limited" | "lock_failed" }

export type RedeemInput = {
  token: string
  ip: string
  provider?: LockProvider
  limiter?: RateLimiter
  sendEmail?: GuestUnlockEmailSender
  now?: Date
}

async function resolveShareTokenAt(token: string, now: Date): Promise<ResolvedGrant | GrantFailure> {
  const grant = await prisma.shareGrant.findUnique({
    where: { tokenHash: hashShareToken(token) },
    select: {
      id: true,
      guestLabel: true,
      expiresAt: true,
      maxUses: true,
      usedCount: true,
      revokedAt: true,
      locker: {
        select: {
          id: true,
          name: true,
          vendorLockId: true,
          user: {
            select: {
              email: true,
              guestUnlockEmails: true,
            },
          },
        },
      },
    },
  })

  if (!grant) return { ok: false, reason: "not_found" }
  if (grant.revokedAt) return { ok: false, reason: "revoked" }
  if (grant.expiresAt <= now) return { ok: false, reason: "expired" }
  if (grant.usedCount >= grant.maxUses) return { ok: false, reason: "exhausted" }

  return {
    ok: true,
    grant: {
      id: grant.id,
      guestLabel: grant.guestLabel,
      expiresAt: grant.expiresAt,
      maxUses: grant.maxUses,
      usedCount: grant.usedCount,
      locker: grant.locker,
    },
  }
}

export function resolveShareToken(token: string): Promise<ResolvedGrant | GrantFailure> {
  return resolveShareTokenAt(token, new Date())
}

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex")
}

async function releaseClaimAndRecordFailure(input: {
  grantId: string
  lockerId: string
  ipHash: string
  errorCode: string
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "ShareGrant"
      SET "usedCount" = GREATEST("usedCount" - 1, 0)
      WHERE "id" = ${input.grantId}
    `
    await tx.lockEvent.create({
      data: {
        lockerId: input.lockerId,
        grantId: input.grantId,
        actorType: ActorType.GUEST,
        action: LockAction.UNLOCK,
        success: false,
        errorCode: input.errorCode,
        ipHash: input.ipHash,
      },
    })
  })
}

export async function redeemShareToken({
  token,
  ip,
  provider,
  limiter = getRateLimiter(),
  sendEmail = sendGuestUnlockEmail,
  now = new Date(),
}: RedeemInput): Promise<RedeemResult> {
  const lockProvider = provider ?? await getLockProvider()
  const tokenHash = hashShareToken(token)

  const ipAllowed = await limiter.check(`share:ip:${ip}`, 10, 60_000)
  if (!ipAllowed) return { ok: false, reason: "rate_limited" }
  const tokenAllowed = await limiter.check(`share:token:${tokenHash}`, 20, 60_000)
  if (!tokenAllowed) return { ok: false, reason: "rate_limited" }

  const resolved = await resolveShareTokenAt(token, now)
  if (!resolved.ok) return resolved

  const { grant } = resolved
  const claimed = await prisma.$executeRaw`
    UPDATE "ShareGrant"
    SET "usedCount" = "usedCount" + 1
    WHERE "tokenHash" = ${tokenHash}
      AND "revokedAt" IS NULL
      AND "expiresAt" > ${now}
      AND "usedCount" < "maxUses"
  `
  if (claimed === 0) {
    const current = await resolveShareTokenAt(token, now)
    return current.ok ? { ok: false, reason: "exhausted" } : current
  }

  const ipHash = hashIp(ip)
  let errorCode: string | null = null
  try {
    const result = await lockProvider.unlock(grant.locker.vendorLockId)
    if (!result.success) errorCode = result.errorCode
  } catch {
    errorCode = "provider_error"
  }

  if (errorCode) {
    await releaseClaimAndRecordFailure({
      grantId: grant.id,
      lockerId: grant.locker.id,
      ipHash,
      errorCode,
    })
    return { ok: false, reason: "lock_failed" }
  }

  await prisma.$transaction([
    prisma.locker.update({
      where: { id: grant.locker.id },
      data: { status: LockStatus.UNLOCKED, lastSyncedAt: now },
    }),
    prisma.lockEvent.create({
      data: {
        lockerId: grant.locker.id,
        grantId: grant.id,
        actorType: ActorType.GUEST,
        action: LockAction.UNLOCK,
        success: true,
        ipHash,
        createdAt: now,
      },
    }),
  ])

  if (grant.locker.user.guestUnlockEmails && grant.locker.user.email) {
    const email: GuestUnlockEmailInput = {
      to: grant.locker.user.email,
      lockerName: grant.locker.name,
      guestLabel: grant.guestLabel,
      unlockedAt: now,
    }
    try {
      const sent = await sendEmail(email)
      if (!sent) console.error("Guest unlock notification failed")
    } catch {
      console.error("Guest unlock notification failed")
    }
  }

  return { ok: true }
}
