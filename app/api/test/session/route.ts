import { randomBytes } from "node:crypto"
import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import { getEnv } from "@/lib/env"

const SESSION_COOKIE = "authjs.session-token"
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000

function notFound(): Response {
  return new Response(null, { status: 404 })
}

export async function POST(request: Request): Promise<Response> {
  if (getEnv().E2E !== "1") return notFound()

  let email: unknown
  try {
    const body = await request.json() as { email?: unknown }
    email = body.email
  } catch {
    return notFound()
  }

  if (typeof email !== "string" || email.trim() === "") return notFound()

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true },
  })
  if (!user) return notFound()

  const sessionToken = randomBytes(32).toString("hex")
  const expires = new Date(Date.now() + SESSION_LIFETIME_MS)
  await prisma.session.create({
    data: { sessionToken, userId: user.id, expires },
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, sessionToken, {
    expires,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })

  return Response.json({ ok: true })
}
