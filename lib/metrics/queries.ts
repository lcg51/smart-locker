import { prisma } from "@/lib/db"

export type PilotMetrics = {
  activeResidents: number
  ownerUnlocks: number
  guestUnlocks: number
  failedUnlocks: number
  unlockSuccessRate: number
  sharesCreated: number
  sharesRedeemed: number
  shareConversionRate: number
  revokedShares: number
  expiredShares: number
}

export async function getPilotMetrics(input: {
  from: Date
  to: Date
  now?: Date
}): Promise<PilotMetrics> {
  const now = input.now ?? new Date()

  const [events, grants] = await Promise.all([
    prisma.lockEvent.findMany({
      where: { createdAt: { gte: input.from, lte: input.to } },
      select: {
        actorType: true,
        action: true,
        success: true,
        grantId: true,
        locker: { select: { userId: true } },
      },
    }),
    prisma.shareGrant.findMany({
      where: { createdAt: { gte: input.from, lte: input.to } },
      select: {
        id: true,
        revokedAt: true,
        expiresAt: true,
      },
    }),
  ])

  const unlockEvents = events.filter((event) => event.action === "UNLOCK")
  const successfulUnlocks = unlockEvents.filter((event) => event.success)

  const activeResidents = new Set(
    events
      .filter((event) => event.success && (event.actorType === "OWNER" || event.actorType === "GUEST"))
      .map((event) => event.locker.userId),
  ).size

  const ownerUnlocks = successfulUnlocks.filter((event) => event.actorType === "OWNER").length
  const guestUnlocks = successfulUnlocks.filter((event) => event.actorType === "GUEST").length
  const failedUnlocks = unlockEvents.filter((event) => !event.success).length

  const unlockSuccessRate = unlockEvents.length === 0
    ? 0
    : successfulUnlocks.length / unlockEvents.length

  const sharesCreated = grants.length
  const sharesRedeemed = new Set(
    successfulUnlocks
      .filter((event) => event.actorType === "GUEST" && event.grantId !== null)
      .map((event) => event.grantId),
  ).size
  const shareConversionRate = sharesCreated === 0 ? 0 : sharesRedeemed / sharesCreated

  const revokedShares = grants.filter((grant) => grant.revokedAt !== null).length
  const expiredShares = grants.filter(
    (grant) => grant.revokedAt === null && grant.expiresAt < now,
  ).length

  return {
    activeResidents,
    ownerUnlocks,
    guestUnlocks,
    failedUnlocks,
    unlockSuccessRate,
    sharesCreated,
    sharesRedeemed,
    shareConversionRate,
    revokedShares,
    expiredShares,
  }
}
