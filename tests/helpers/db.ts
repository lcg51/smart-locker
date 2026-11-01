import { prisma } from "@/lib/db"

export async function resetDb(): Promise<void> {
  await prisma.lockEvent.deleteMany()
  await prisma.shareGrant.deleteMany()
  await prisma.locker.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.verificationToken.deleteMany()
  await prisma.user.deleteMany()
  await prisma.allowedEmail.deleteMany()
  await prisma.vendorCredential.deleteMany()
}
