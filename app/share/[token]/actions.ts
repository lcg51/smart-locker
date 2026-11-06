"use server"

import { headers } from "next/headers"
import { redeemShareToken, resolveShareToken } from "@/lib/shares/redeem"
import type { RedeemResult } from "@/lib/shares/redeem"
import { relockShareToken } from "@/lib/locks/relock"

export type GuestRedeemResult =
  | { ok: true; relockAt: Date; canUnlockAgain: boolean }
  | Exclude<RedeemResult, { ok: true }>

export async function redeemShare(token: string): Promise<GuestRedeemResult> {
  const requestHeaders = await headers()
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  const result = await redeemShareToken({ token, ip })
  if (!result.ok) return result

  try {
    return {
      ok: true,
      relockAt: result.relockAt,
      canUnlockAgain: (await resolveShareToken(token)).ok,
    }
  } catch {
    // The unlock already succeeded; don't turn a follow-up status read into a false failure.
    return { ok: true, relockAt: result.relockAt, canUnlockAgain: false }
  }
}

export async function relockShare(token: string): Promise<{ ok: boolean; errorCode?: string }> {
  return relockShareToken({ token })
}
