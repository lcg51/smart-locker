import { Resend } from "resend"
import { getEnv } from "@/lib/env"
import type { Locale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { fill } from "@/lib/i18n/format"

export type MagicLinkEmailInput = {
  to: string
  url: string
  locale: Locale
}

/**
 * Resolve the request locale, falling back to English when the send runs
 * outside a request context.
 */
export async function resolveMagicLinkLocale(
  lookup: () => Promise<Locale>,
): Promise<Locale> {
  try {
    return await lookup()
  } catch {
    return "en"
  }
}

export async function sendMagicLinkEmail(input: MagicLinkEmailInput): Promise<void> {
  const env = getEnv()
  const dictionary = getDictionary(input.locale)
  const resend = new Resend(env.RESEND_API_KEY)
  const response = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: input.to,
    subject: dictionary.email.signInSubject,
    text: fill(dictionary.email.signInBody, { url: input.url }),
  })

  if (response.error || !response.data?.id) {
    // Do not log the recipient or the sign-in URL.
    console.error("Magic link email failed")
    throw new Error("magic_link_email_failed")
  }
}
