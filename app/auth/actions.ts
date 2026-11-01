"use server"

import { z } from "zod"
import { signIn } from "@/auth"

const emailSchema = z.string().trim().email()

export async function requestMagicLink(formData: FormData): Promise<void> {
  const email = emailSchema.parse(formData.get("email"))
  await signIn("resend", { email, redirectTo: "/dashboard" })
}
