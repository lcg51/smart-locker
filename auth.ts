import NextAuth from "next-auth"
import Resend from "next-auth/providers/resend"
import { adapter } from "@/lib/auth/adapter"
import { isEmailAllowed } from "@/lib/auth/allowlist"
import { getEnv } from "@/lib/env"

const env = getEnv()

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  session: { strategy: "database", maxAge: 30 * 24 * 60 * 60 },
  providers: [Resend({ from: env.EMAIL_FROM, apiKey: env.RESEND_API_KEY })],
  pages: { signIn: "/auth", verifyRequest: "/auth/check-email", error: "/auth" },
  callbacks: {
    async signIn({ user }) {
      // Return a URL instead of `false`: Auth.js turns `false` into an
      // AccessDenied error, which can surface as a 500 page. A redirect lands
      // on /auth with a neutral notice.
      if (!user.email) return "/auth?error=not_invited"
      try {
        return (await isEmailAllowed(user.email)) ? true : "/auth?error=not_invited"
      } catch {
        return "/auth?error=unavailable"
      }
    },
    async session({ session, user }) {
      session.user.id = user.id
      return session
    },
  },
})
