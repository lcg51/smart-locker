"use server"

import { revalidatePath } from "next/cache"
import { getEnv } from "@/lib/env"
import { requireUser } from "@/lib/auth/session"
import { createShareGrant, revokeShareGrant } from "@/lib/shares/service"

export async function createShare(lockerId: string, formData: FormData): Promise<{ url: string; grantId: string }> {
  const user = await requireUser()
  const durationValue = formData.get("durationMinutes")
  const maxUsesValue = formData.get("maxUses")
  const guestLabelValue = formData.get("guestLabel")
  const durationMinutes = typeof durationValue === "string" ? Number(durationValue) : undefined
  const maxUses = typeof maxUsesValue === "string" ? Number(maxUsesValue) : undefined
  const guestLabel = typeof guestLabelValue === "string" ? guestLabelValue : undefined
  const { token, grant } = await createShareGrant({ userId: user.id, lockerId, durationMinutes, maxUses, guestLabel })
  const url = new URL(`/share/${token}`, getEnv().APP_URL).toString()

  revalidatePath(`/dashboard/lockers/${lockerId}`)
  return { url, grantId: grant.id }
}

export async function revokeShare(grantId: string): Promise<boolean> {
  const user = await requireUser()
  const revoked = await revokeShareGrant({ userId: user.id, grantId })
  if (revoked) revalidatePath("/dashboard/lockers/[id]", "page")
  return revoked
}
