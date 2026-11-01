import { auth } from "@/auth"
import { redirect } from "next/navigation"

export async function requireUser(): Promise<{ id: string; email: string }> {
  const session = await auth()

  if (!session?.user) redirect("/auth")
  if (!session.user.email) redirect("/auth/error")

  return { id: session.user.id, email: session.user.email }
}
