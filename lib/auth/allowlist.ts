import { prisma } from "@/lib/db"

export async function isEmailAllowed(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase()
  const allowed = await prisma.allowedEmail.findUnique({ where: { email: normalized } })
  return allowed !== null
}
