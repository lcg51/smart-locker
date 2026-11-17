import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"

export type ActiveSession = {
  id: string
  createdAt: Date
  expires: Date
  isCurrent: boolean
}

export async function requireUser(): Promise<{ id: string; email: string }> {
  const session = await auth()

  if (!session?.user) redirect("/auth")
  if (!session.user.email) redirect("/auth/error")

  return { id: session.user.id, email: session.user.email }
}

export async function getCurrentSessionToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get("authjs.session-token")?.value
    ?? cookieStore.get("__Secure-authjs.session-token")?.value
    ?? null
}

export async function revokeOtherSessions(input: {
  userId: string
  currentToken: string | null
}): Promise<{ revoked: number }> {
  const result = await prisma.session.deleteMany({
    where: {
      userId: input.userId,
      ...(input.currentToken ? { NOT: { sessionToken: input.currentToken } } : {}),
    },
  })

  return { revoked: result.count }
}

export async function listActiveSessions(
  userId: string,
  currentToken: string | null = null,
): Promise<ActiveSession[]> {
  const sessions = await prisma.session.findMany({
    where: {
      userId,
      expires: { gt: new Date() },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      sessionToken: true,
      createdAt: true,
      expires: true,
    },
  })

  return sessions.map((session) => ({
    id: session.id,
    createdAt: session.createdAt,
    expires: session.expires,
    isCurrent: currentToken !== null && session.sessionToken === currentToken,
  }))
}
