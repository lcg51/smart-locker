import { prisma } from "@/lib/db"

export async function deleteAccount(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    })

    await tx.lockEvent.deleteMany({ where: { locker: { userId } } })
    await tx.shareGrant.deleteMany({
      where: {
        OR: [{ createdByUserId: userId }, { locker: { userId } }],
      },
    })
    await tx.locker.deleteMany({ where: { userId } })
    await tx.session.deleteMany({ where: { userId } })
    await tx.account.deleteMany({ where: { userId } })
    if (user.email) {
      await tx.verificationToken.deleteMany({ where: { identifier: user.email } })
    }
    await tx.user.delete({ where: { id: userId } })
    if (user.email) {
      await tx.allowedEmail.deleteMany({ where: { email: user.email } })
    }
  })
}
