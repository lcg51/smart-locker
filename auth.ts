import { PrismaAdapter } from "@auth/prisma-adapter"
import NextAuth from "next-auth"
import Resend from "next-auth/providers/resend"
import { isEmailAllowed } from "@/lib/auth/allowlist"
import { prisma } from "@/lib/db"
import { getEnv } from "@/lib/env"

const env = getEnv()

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database", maxAge: 30 * 24 * 60 * 60 },
  providers: [Resend({ from: env.EMAIL_FROM, apiKey: env.RESEND_API_KEY })],
  pages: { signIn: "/auth", verifyRequest: "/auth/check-email", error: "/auth/error" },
  callbacks: {
    async signIn({ user }) {
      return user.email ? isEmailAllowed(user.email) : false
    },
    async session({ session, user }) {
      session.user.id = user.id
      return session
    },
  },
})
