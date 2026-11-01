import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/session"
import { refreshLockerState } from "@/lib/lockers/service"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser()
  const { id } = await params
  const result = await refreshLockerState({ userId: user.id, lockerId: id })

  if (!result.ok) {
    if (result.errorCode === "not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 })
    }
    return NextResponse.json({ error: "provider_error" }, { status: 502 })
  }

  return NextResponse.json(result.state)
}
