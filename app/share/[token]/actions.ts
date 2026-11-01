"use server"

import { headers } from "next/headers"
import { redeemShareToken, resolveShareToken } from "@/lib/shares/redeem"
import type { RedeemResult } from "@/lib/shares/redeem"

export type GuestRedeemResult = RedeemResult | { ok: true; canUnlockAgain: boolean }

export async function redeemShare(token: string): Promise<GuestRedeemResult> {
  const requestHeaders = await headers()
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  const result = await redeemShareToken({ token, ip })
  if (!result.ok) return result

  try {
    return { ok: true, canUnlockAgain: (await resolveShareToken(token)).ok }
  } catch {
    // The unlock already succeeded; don't turn a follow-up status read into a false failure.
    return { ok: true, canUnlockAgain: false }
  }
}
