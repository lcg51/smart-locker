import { redirect } from "next/navigation"

export default function AuthErrorPage() {
  redirect("/auth?error=not_invited")
}
