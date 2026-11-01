import { Resend } from "resend"
import { getEnv } from "@/lib/env"

export type GuestUnlockEmailInput = {
  to: string
  lockerName: string
  guestLabel: string | null
  unlockedAt: Date
}

export type GuestUnlockEmailSender = (input: GuestUnlockEmailInput) => Promise<boolean>

export async function sendGuestUnlockEmail(input: GuestUnlockEmailInput): Promise<boolean> {
  try {
    const env = getEnv()
    const resend = new Resend(env.RESEND_API_KEY)
    const unlockedAt = new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "long",
      timeZone: "UTC",
    }).format(input.unlockedAt)
    const guest = input.guestLabel?.trim() || "A guest"
    const response = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: `${input.lockerName} was unlocked`,
      text: `${guest} unlocked ${input.lockerName} at ${unlockedAt}.`,
    })

    if (response.error || !response.data?.id) {
      console.error("Guest unlock notification failed")
      return false
    }
    return true
  } catch {
    console.error("Guest unlock notification failed")
    return false
  }
}
