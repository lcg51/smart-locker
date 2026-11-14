import { prisma } from "@/lib/db"

export type RetentionPolicy = {
  inactiveGrantDays: number
  expiredSessionDays: number
  lockEventDays: number
}

const DEFAULT_RETENTION: RetentionPolicy = {
  inactiveGrantDays: 30,
  expiredSessionDays: 30,
  lockEventDays: 365,
}

const DAY_MS = 24 * 60 * 60 * 1000

function cutoff(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS)
}

export async function cleanupExpiredData(input: {
  now?: Date
  retention?: Partial<RetentionPolicy>
} = {}): Promise<{
  grants: number
  sessions: number
  verificationTokens: number
  lockEvents: number
}> {
  const now = input.now ?? new Date()
  const retention = { ...DEFAULT_RETENTION, ...input.retention }
  const grantCutoff = cutoff(now, retention.inactiveGrantDays)
  const sessionCutoff = cutoff(now, retention.expiredSessionDays)
  const eventCutoff = cutoff(now, retention.lockEventDays)

  const [grants, sessions, verificationTokens, lockEvents] = await prisma.$transaction([
    prisma.shareGrant.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: grantCutoff } },
          { revokedAt: { lt: grantCutoff } },
        ],
      },
    }),
    prisma.session.deleteMany({
      where: { expires: { lt: sessionCutoff } },
    }),
    prisma.verificationToken.deleteMany({
      where: { expires: { lt: sessionCutoff } },
    }),
    prisma.lockEvent.deleteMany({
      where: { createdAt: { lt: eventCutoff } },
    }),
  ])

  return {
    grants: grants.count,
    sessions: sessions.count,
    verificationTokens: verificationTokens.count,
    lockEvents: lockEvents.count,
  }
}
