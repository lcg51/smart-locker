import { PrismaAdapter } from "@auth/prisma-adapter"
import { headers } from "next/headers"
import { prisma } from "@/lib/db"
import { sessionMetadataFromHeaders } from "@/lib/auth/session-metadata"

const baseAdapter = PrismaAdapter(prisma)

export const adapter = {
  ...baseAdapter,
  async createSession(session: {
    sessionToken: string
    userId: string
    expires: Date
  }) {
    let metadata: { deviceLabel: string; locationLabel: string | null } = {
      deviceLabel: "Unknown device",
      locationLabel: null,
    }

    try {
      // These headers are injected by the hosting platform or a trusted proxy.
      // They are display-only and never used for authorization.
      const requestHeaders = await headers()
      metadata = sessionMetadataFromHeaders((name) => requestHeaders.get(name))
    } catch {
      // Session creation can run outside a request scope in tests or scripts.
    }

    return prisma.session.create({
      data: {
        ...session,
        ...metadata,
      },
    })
  },
  async deleteSession(sessionToken: string): Promise<void> {
    if (!baseAdapter.deleteSession) return

    try {
      await baseAdapter.deleteSession(sessionToken)
    } catch (error) {
      // A revoked session can still have a cookie in the browser. Auth.js then
      // tries to delete it during the next sign-in; a missing row is not an error.
      if (
        error !== null
        && typeof error === "object"
        && "code" in error
        && (error as { code?: string }).code === "P2025"
      ) {
        return
      }
      throw error
    }
  },
}
