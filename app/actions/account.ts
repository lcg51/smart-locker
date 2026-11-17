"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { signOut } from "@/auth"
import {
  getCurrentSessionToken,
  requireUser,
  revokeOtherSessions,
} from "@/lib/auth/session"
import { deleteAccount } from "@/lib/account/delete"
import { updateDisplayName } from "@/lib/account/profile"
import { prisma } from "@/lib/db"

const guestUnlockEmailsSchema = z.object({
  userId: z.string().min(1),
  enabled: z.boolean(),
})

export async function setGuestUnlockEmails(userId: string, enabled: boolean): Promise<void> {
  const parsed = guestUnlockEmailsSchema.safeParse({ userId, enabled })
  if (!parsed.success) throw new Error("invalid_guest_unlock_email_preference")

  const user = await requireUser()
  if (parsed.data.userId !== user.id) throw new Error("unauthorized_account_update")
  await prisma.user.update({
    where: { id: user.id },
    data: { guestUnlockEmails: parsed.data.enabled },
  })
  revalidatePath("/dashboard/settings")
}

export async function deleteAccountAction(): Promise<void> {
  const user = await requireUser()
  await deleteAccount(user.id)
  await signOut({ redirectTo: "/auth" })
}

export async function updateDisplayNameAction(formData: FormData): Promise<boolean> {
  const user = await requireUser()
  const name = formData.get("name")
  if (typeof name !== "string") return false

  const updated = await updateDisplayName({ userId: user.id, name })
  if (updated) revalidatePath("/dashboard/settings")
  return updated
}

export async function revokeOtherSessionsAction(): Promise<{ revoked: number }> {
  const user = await requireUser()
  const currentToken = await getCurrentSessionToken()
  const result = await revokeOtherSessions({ userId: user.id, currentToken })
  revalidatePath("/dashboard/settings")
  return result
}
