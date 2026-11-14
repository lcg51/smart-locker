"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"
import { signIn } from "@/auth"
import { checkMagicLinkRateLimit } from "@/lib/auth/rate-limit"

const emailSchema = z.string().trim().email()

export async function requestMagicLink(formData: FormData): Promise<void> {
  const email = emailSchema.parse(formData.get("email"))
  const requestHeaders = await headers()
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"

  if (!(await checkMagicLinkRateLimit({ email, ip }))) {
    redirect("/auth/check-email")
  }

  await signIn("resend", { email, redirectTo: "/dashboard" })
}
