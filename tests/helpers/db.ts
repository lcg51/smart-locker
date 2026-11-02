import { prisma } from "@/lib/db"
import { assertTestDatabaseUrl } from "@/lib/test-db-guard"

export async function resetDb(): Promise<void> {
  assertTestDatabaseUrl(process.env.DATABASE_URL)
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
