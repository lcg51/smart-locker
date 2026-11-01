"use server"

import { z } from "zod"
import { signIn, signOut } from "@/auth"

const emailSchema = z.string().trim().email()

export async function requestMagicLink(formData: FormData): Promise<void> {
  const email = emailSchema.parse(formData.get("email"))
  await signIn("resend", { email, redirectTo: "/dashboard" })
}

export async function logout(): Promise<void> {
  await signOut({ redirectTo: "/auth" })
}
