import { Resend } from "resend"
import { getEnv } from "@/lib/env"
import type { Locale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { fill } from "@/lib/i18n/format"

export type GuestUnlockEmailInput = {
  to: string
  lockerName: string
  guestLabel: string | null
  unlockedAt: Date
  locale?: Locale
}

export type GuestUnlockEmailSender = (input: GuestUnlockEmailInput) => Promise<boolean>

export async function sendGuestUnlockEmail(input: GuestUnlockEmailInput): Promise<boolean> {
  try {
    const env = getEnv()
    const resend = new Resend(env.RESEND_API_KEY)
    const locale = input.locale ?? "en"
    const dictionary = getDictionary(locale)
    const unlockedAt = new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Madrid",
    }).format(input.unlockedAt)
    const guest = input.guestLabel?.trim() || dictionary.email.guestFallback
    const response = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: fill(dictionary.email.guestSubject, { locker: input.lockerName }),
      text: fill(dictionary.email.guestBody, {
        guest,
        locker: input.lockerName,
        time: unlockedAt,
      }),
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
