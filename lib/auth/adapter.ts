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
}
