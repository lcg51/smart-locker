"use server"

import { revalidatePath } from "next/cache"
import { getEnv } from "@/lib/env"
import { requireUser } from "@/lib/auth/session"
import { createShareGrant, revokeShareGrant, ShareLimitError } from "@/lib/shares/service"

export type CreateShareResult =
  | { ok: true; url: string; grantId: string }
  | { ok: false; error: "rate_limited" | "share_limit_reached" | "sharing_disabled" | "invalid_input" }

export async function createShare(
  lockerId: string,
  formData: FormData,
): Promise<CreateShareResult> {
  const user = await requireUser()
  const durationValue = formData.get("durationMinutes")
  const maxUsesValue = formData.get("maxUses")
  const guestLabelValue = formData.get("guestLabel")
  const durationMinutes = typeof durationValue === "string" ? Number(durationValue) : undefined
  const maxUses = typeof maxUsesValue === "string" ? Number(maxUsesValue) : undefined
  const guestLabel = typeof guestLabelValue === "string" ? guestLabelValue : undefined

  try {
    const { token, grant } = await createShareGrant({
      userId: user.id,
      lockerId,
      durationMinutes,
      maxUses,
      guestLabel,
    })
    const url = new URL(`/share/${token}`, getEnv().APP_URL).toString()

    revalidatePath(`/dashboard/lockers/${lockerId}`)
    return { ok: true, url, grantId: grant.id }
  } catch (error) {
    if (error instanceof ShareLimitError) {
      return { ok: false, error: error.code }
    }
    return { ok: false, error: "invalid_input" }
  }
}

export async function revokeShare(grantId: string): Promise<boolean> {
  const user = await requireUser()
  const revoked = await revokeShareGrant({ userId: user.id, grantId })
  if (revoked) revalidatePath("/dashboard/lockers/[id]", "page")
  return revoked
}
