import { prisma } from "@/lib/db"

export async function listLockEvents(input: {
  userId: string
  lockerId?: string
  cursor?: string
  limit?: number
}) {
  const requestedLimit = input.limit ?? 50
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(100, Math.max(1, Math.trunc(requestedLimit)))
    : 50

  const events = await prisma.lockEvent.findMany({
    where: {
      locker: { userId: input.userId },
      ...(input.lockerId ? { lockerId: input.lockerId } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  })

  const hasMore = events.length > limit
  const page = hasMore ? events.slice(0, limit) : events

  return {
    events: page,
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
  }
}
