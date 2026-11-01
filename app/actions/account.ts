"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireUser } from "@/lib/auth/session"
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
