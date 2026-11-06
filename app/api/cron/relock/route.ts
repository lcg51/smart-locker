import { getEnv } from "@/lib/env"
import { relockDueLockers } from "@/lib/locks/relock"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const secret = getEnv().CRON_SECRET
  if (!secret) return Response.json({ error: "cron_not_configured" }, { status: 503 })
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  return Response.json(await relockDueLockers())
}
