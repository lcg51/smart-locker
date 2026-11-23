"use server"

import { headers } from "next/headers"
import { redirect, unstable_rethrow } from "next/navigation"
import { z } from "zod"
import { signIn } from "@/auth"
import type { RequestMagicLinkState } from "@/lib/auth/magic-link-state"
import { checkMagicLinkRateLimit } from "@/lib/auth/rate-limit"
import { getDictionary, getLocale } from "@/lib/i18n/server"

const emailSchema = z.string().trim().email()

export async function requestMagicLink(
  _previous: RequestMagicLinkState,
  formData: FormData,
): Promise<RequestMagicLinkState> {
  const dictionary = getDictionary(await getLocale())
  const parsed = emailSchema.safeParse(formData.get("email"))
  if (!parsed.success) return { error: dictionary.auth.notice.email, at: Date.now() }

  const email = parsed.data
  const requestHeaders = await headers()
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"

  if (!(await checkMagicLinkRateLimit({ email, ip }))) {
    // Same destination as a successful request, so the limit cannot be used to
    // probe which addresses are invited.
    redirect("/auth/check-email")
  }

  try {
    await signIn("resend", { email, redirectTo: "/dashboard" })
  } catch (error) {
    // `signIn` redirects on success; rethrow Next's redirect instead of
    // reporting it as a delivery failure.
    unstable_rethrow(error)
    return { error: dictionary.auth.notice.send, at: Date.now() }
  }

  return { error: null, at: Date.now() }
}
