"use server"

import { headers } from "next/headers"
import { redirect, unstable_rethrow } from "next/navigation"
import { z } from "zod"
import { signIn } from "@/auth"
import { checkMagicLinkRateLimit } from "@/lib/auth/rate-limit"
import { SIGN_IN_EMAIL_ERROR, SIGN_IN_SEND_ERROR } from "@/lib/auth/sign-in-notice"

const emailSchema = z.string().trim().email()

export type RequestMagicLinkState = {
  error: string | null
  at: number
}

export const initialRequestMagicLinkState: RequestMagicLinkState = { error: null, at: 0 }

export async function requestMagicLink(
  _previous: RequestMagicLinkState,
  formData: FormData,
): Promise<RequestMagicLinkState> {
  const parsed = emailSchema.safeParse(formData.get("email"))
  if (!parsed.success) return { error: SIGN_IN_EMAIL_ERROR, at: Date.now() }

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
    return { error: SIGN_IN_SEND_ERROR, at: Date.now() }
  }

  return { error: null, at: Date.now() }
}
