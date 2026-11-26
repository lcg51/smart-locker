import NextAuth from "next-auth"
import Resend from "next-auth/providers/resend"
import { adapter } from "@/lib/auth/adapter"
import { resolveSignIn } from "@/lib/auth/sign-in-callback"
import { sendMagicLinkEmail, resolveMagicLinkLocale } from "@/lib/email/magic-link"
import { getLocale } from "@/lib/i18n/server"
import { getEnv } from "@/lib/env"

const env = getEnv()

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  session: { strategy: "database", maxAge: 30 * 24 * 60 * 60 },
  providers: [
    Resend({
      from: env.EMAIL_FROM,
      apiKey: env.RESEND_API_KEY,
      async sendVerificationRequest({ identifier, url }) {
        const locale = await resolveMagicLinkLocale(getLocale)
        await sendMagicLinkEmail({ to: identifier, url, locale })
      },
    }),
  ],
  pages: { signIn: "/auth", verifyRequest: "/auth/check-email", error: "/auth" },
  callbacks: {
    async signIn({ user }) {
      return resolveSignIn(user.email, getLocale)
    },
    async session({ session, user }) {
      session.user.id = user.id
      return session
    },
  },
})
