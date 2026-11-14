import { prisma } from "@/lib/db"

export async function bulkRevokeGrants(input: {
  all?: boolean
  email?: string
  now?: Date
}): Promise<{ revoked: number }> {
  if (Boolean(input.all) === Boolean(input.email)) {
    throw new Error("exactly_one_of_all_or_email")
  }

  const now = input.now ?? new Date()
  let userId: string | undefined

  if (input.email) {
    const email = input.email.trim().toLowerCase()
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    })
    if (!user) return { revoked: 0 }
    userId = user.id
  }

  const result = await prisma.shareGrant.updateMany({
    where: {
      revokedAt: null,
      ...(userId ? { createdByUserId: userId } : {}),
    },
    data: { revokedAt: now },
  })

  return { revoked: result.count }
}
