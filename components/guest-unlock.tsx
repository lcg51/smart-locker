"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { Check, LockKeyhole, LockKeyholeOpen } from "lucide-react"
import { redeemShare, relockShare } from "@/app/share/[token]/actions"
import type { GuestRedeemResult } from "@/app/share/[token]/actions"
import { Button } from "@/components/ui/button"
import { isGuestUnlockDisabled } from "@/lib/shares/guest-ui-state"

type RelockState = "idle" | "pending" | "done" | "failed"

function parseDeadline(value: string | null | undefined): number | null {
  if (!value) return null
  const deadline = Date.parse(value)
  return Number.isNaN(deadline) ? null : deadline
}

function secondsUntil(deadline: number): number {
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1_000))
}

function getErrorMessage(result: Extract<GuestRedeemResult, { ok: false }>): string {
  if (result.reason === "rate_limited") return "Too many attempts. Please wait a minute and try again."
  if (result.reason === "lock_failed") return "The locker couldn't be unlocked. Please try again."
  return "This link is no longer available. Ask for a new link."
}

export function GuestUnlock({
  token,
  initialRelockAt = null,
  relockOnly = false,
}: {
  token: string
  initialRelockAt?: string | null
  relockOnly?: boolean
}) {
  const initialDeadline = parseDeadline(initialRelockAt)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState(initialDeadline !== null)
  const [canUnlockAgain, setCanUnlockAgain] = useState(!relockOnly)
  const [relockAt, setRelockAt] = useState<number | null>(initialDeadline)
  const [secondsRemaining, setSecondsRemaining] = useState(0)
  const [measured, setMeasured] = useState(false)
  const [relockState, setRelockState] = useState<RelockState>("idle")
  const relockInFlight = useRef(false)

  useEffect(() => {
    if (relockAt === null) return

    const update = () => {
      setSecondsRemaining(secondsUntil(relockAt))
      setMeasured(true)
    }

    // The countdown is anchored to the server deadline, so the first tick has to
    // measure it after mount rather than during render.
    update()
    const interval = window.setInterval(update, 1_000)
    return () => window.clearInterval(interval)
  }, [relockAt])

  useEffect(() => {
    if (!measured || relockAt === null || secondsRemaining > 0 || relockState !== "idle") return
    if (relockInFlight.current) return

    relockInFlight.current = true
    // The request begins after the countdown reaches zero; the server result
    // decides what the guest sees.
    setRelockState("pending")

    void (async () => {
      try {
        const result = await relockShare(token)
        relockInFlight.current = false
        if (result.ok) {
          setRelockAt(null)
          setRelockState("done")
        } else {
          setRelockState("failed")
        }
      } catch {
        relockInFlight.current = false
        setRelockState("failed")
      }
    })()
  }, [measured, relockAt, relockState, secondsRemaining, token])

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

        const deadline = new Date(result.relockAt).getTime()
        setUnlocked(true)
        setRelockAt(deadline)
        setSecondsRemaining(secondsUntil(deadline))
        setMeasured(true)
        setRelockState("idle")
        setCanUnlockAgain(result.canUnlockAgain)
      } catch {
        setError("We couldn't complete that request. Check your connection and try again.")
      }
    })
  }

  const isCoolingDown = relockAt !== null && secondsRemaining > 0
  const isRelocking = relockState === "pending"
  const disabled =
    isRelocking ||
    isGuestUnlockDisabled({ isPending, isCoolingDown: relockAt !== null, canUnlockAgain })

  return (
    <div className="space-y-4">
      {unlocked && (
        <div aria-live="polite" className="rounded-lg border border-emerald-700/20 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-300/20 dark:bg-emerald-950 dark:text-emerald-50" role="status">
          <p className="flex items-center gap-2 font-medium">
            <Check aria-hidden="true" className="size-4" />
            {relockOnly ? "Relocking locker" : "Locker unlocked"}
          </p>
          {relockState === "done" ? (
            <p className="mt-1 text-sm opacity-80">
              Locker relocked.{canUnlockAgain ? " You can unlock it again if needed." : " This link has no unlocks remaining."}
            </p>
          ) : relockState === "failed" ? (
            <div className="mt-1 space-y-2">
              <p className="text-sm opacity-80">The locker didn&apos;t relock. Try again.</p>
              <Button
                onClick={() => setRelockState("idle")}
                size="sm"
                type="button"
                variant="outline"
              >
                Try relock
              </Button>
            </div>
          ) : isRelocking || (relockAt !== null && secondsRemaining <= 0) ? (
            <p className="mt-1 text-sm opacity-80">Relocking…</p>
          ) : isCoolingDown ? (
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

      {error && <p aria-live="polite" className="text-sm text-destructive-text" role="alert">{error}</p>}

      {!relockOnly && (
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
          ) : relockAt !== null ? (
            <>
              <LockKeyholeOpen aria-hidden="true" className="size-5" />
              Unlocked
            </>
          ) : !canUnlockAgain ? (
            <>
              <LockKeyhole aria-hidden="true" className="size-5" />
              {unlocked ? "No unlocks remaining" : "Link unavailable"}
            </>
          ) : (
            <>
              <LockKeyhole aria-hidden="true" className="size-5" />
              Unlock locker
            </>
          )}
        </Button>
      )}
    </div>
  )
}
