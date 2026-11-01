"use client"

import { useEffect, useState, useTransition } from "react"
import { Check, LockKeyhole, LockKeyholeOpen } from "lucide-react"
import { redeemShare } from "@/app/share/[token]/actions"
import type { GuestRedeemResult } from "@/app/share/[token]/actions"
import { Button } from "@/components/ui/button"

const RELOCK_SECONDS = 30

function getErrorMessage(result: Extract<GuestRedeemResult, { ok: false }>): string {
  if (result.reason === "rate_limited") return "Too many attempts. Please wait a minute and try again."
  if (result.reason === "lock_failed") return "The locker couldn't be unlocked. Please try again."
  return "This link is no longer available. Ask for a new link."
}

export function GuestUnlock({ token }: { token: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [canUnlockAgain, setCanUnlockAgain] = useState(true)
  const [secondsRemaining, setSecondsRemaining] = useState(0)

  useEffect(() => {
    if (!unlocked || secondsRemaining <= 0) return

    const timeout = window.setTimeout(() => {
      setSecondsRemaining((seconds) => Math.max(0, seconds - 1))
    }, 1_000)
    return () => window.clearTimeout(timeout)
  }, [secondsRemaining, unlocked])

  function handleUnlock() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await redeemShare(token)
        if (!result.ok) {
          setError(getErrorMessage(result))
          if (["not_found", "revoked", "expired", "exhausted"].includes(result.reason)) {
            setCanUnlockAgain(false)
          }
          return
        }

        setUnlocked(true)
        setSecondsRemaining(RELOCK_SECONDS)
        setCanUnlockAgain("canUnlockAgain" in result ? result.canUnlockAgain : false)
      } catch {
        setError("We couldn't complete that request. Check your connection and try again.")
      }
    })
  }

  const isCoolingDown = unlocked && secondsRemaining > 0
  const disabled = isPending || isCoolingDown || (unlocked && !canUnlockAgain)

  return (
    <div className="space-y-4">
      {unlocked && (
        <div aria-live="polite" className="rounded-lg border border-emerald-700/20 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-300/20 dark:bg-emerald-950 dark:text-emerald-50" role="status">
          <p className="flex items-center gap-2 font-medium">
            <Check aria-hidden="true" className="size-4" />
            Locker unlocked
          </p>
          {isCoolingDown ? (
            <p className="mt-1 text-sm opacity-80">
              It will relock automatically in <span aria-live="off" className="font-semibold tabular-nums">{secondsRemaining}</span> seconds.
            </p>
          ) : canUnlockAgain ? (
            <p className="mt-1 text-sm opacity-80">The locker should now be relocked. You can unlock it again if needed.</p>
          ) : (
            <p className="mt-1 text-sm opacity-80">This link has no unlocks remaining.</p>
          )}
        </div>
      )}

      {error && <p aria-live="polite" className="text-sm text-destructive" role="alert">{error}</p>}

      <Button
        className="min-h-12 w-full text-base"
        disabled={disabled}
        onClick={handleUnlock}
        type="button"
      >
        {isPending ? (
          <>
            <LockKeyhole aria-hidden="true" className="size-5" />
            Unlocking…
          </>
        ) : unlocked && isCoolingDown ? (
          <>
            <LockKeyholeOpen aria-hidden="true" className="size-5" />
            Unlocked
          </>
        ) : unlocked && !canUnlockAgain ? (
          <>
            <LockKeyhole aria-hidden="true" className="size-5" />
            No unlocks remaining
          </>
        ) : (
          <>
            <LockKeyhole aria-hidden="true" className="size-5" />
            Unlock locker
          </>
        )}
      </Button>
    </div>
  )
}
