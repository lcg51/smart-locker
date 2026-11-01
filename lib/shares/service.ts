import { prisma } from "@/lib/db"
import { getLockerForUser } from "@/lib/lockers/queries"
import { generateShareToken, hashShareToken } from "@/lib/shares/token"
import type { ShareGrant } from "@prisma/client"

export type CreateShareInput = {
  userId: string
  lockerId: string
  durationMinutes?: number
  maxUses?: number
  guestLabel?: string
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

  const token = generateShareToken()
  const createdAt = new Date()
  const expiresAt = new Date(createdAt.getTime() + durationMinutes * 60_000)
  const grant = await prisma.shareGrant.create({
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

  return { token, grant }
}

export async function revokeShareGrant(input: {
  userId: string
  grantId: string
}): Promise<boolean> {
  const result = await prisma.shareGrant.updateMany({
    where: {
      id: input.grantId,
      createdByUserId: input.userId,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
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
