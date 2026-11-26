import { Resend } from "resend"
import { getEnv } from "@/lib/env"
import { renderMagicLinkEmail } from "@/lib/email/magic-link-template"
import type { Locale } from "@/lib/i18n/config"

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
  const { subject, html, text } = renderMagicLinkEmail({
    url: input.url,
    locale: input.locale,
  })
  const resend = new Resend(env.RESEND_API_KEY)
  const response = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: input.to,
    subject,
    html,
    text,
  })

  if (response.error || !response.data?.id) {
    // Do not log the recipient or the sign-in URL.
    console.error("Magic link email failed")
    throw new Error("magic_link_email_failed")
  }
}
