import { prisma } from "@/lib/db"

export function getLockersForUser(userId: string) {
  return prisma.locker.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  })
}

export function getLockerForUser(userId: string, lockerId: string) {
  return prisma.locker.findFirst({
    where: { id: lockerId, userId, deletedAt: null },
  })
}
