import { expect, type BrowserContext } from "@playwright/test"
import { prisma } from "../lib/db"
import { createShareGrant } from "../lib/shares/service"

const seededGrantIds: string[] = []

export async function signIn(context: BrowserContext, email = "ana@example.com") {
  const response = await context.request.post("/api/test/session", { data: { email } })
  expect(response.status()).toBe(200)
}

export async function createShareForSeed(input: { durationMinutes?: number; maxUses?: number }) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: "ana@example.com" } })
  const locker = await prisma.locker.findFirstOrThrow({ where: { userId: user.id } })
  const created = await createShareGrant({ userId: user.id, lockerId: locker.id, ...input })
  seededGrantIds.push(created.grant.id)
  return created
}

export async function removeSeededShares() {
  const ids = seededGrantIds.splice(0)
  if (ids.length === 0) return
  await prisma.shareGrant.deleteMany({ where: { id: { in: ids } } })
}
