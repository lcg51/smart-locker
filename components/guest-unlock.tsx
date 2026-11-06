"use client"

import { useEffect, useReducer, useRef, useTransition } from "react"
import { Check, LockKeyhole, LockKeyholeOpen } from "lucide-react"
import { redeemShare, relockShare } from "@/app/share/[token]/actions"
import type { GuestRedeemResult } from "@/app/share/[token]/actions"
import { Button } from "@/components/ui/button"
import { isGuestUnlockDisabled } from "@/lib/shares/guest-ui-state"
import {
  createGuestUnlockState,
  guestUnlockReducer,
} from "@/lib/shares/guest-unlock-state"

const TERMINAL_UNLOCK_REASONS: Extract<GuestRedeemResult, { ok: false }>["reason"][] = [
  "not_found",
  "revoked",
  "expired",
  "exhausted",
]

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
  const [state, dispatch] = useReducer(
    guestUnlockReducer,
    { initialDeadline, relockOnly },
    createGuestUnlockState,
  )
  const relockInFlight = useRef(false)

  useEffect(() => {
    if (state.relockAt === null) return
    const deadline = state.relockAt

    const update = () => {
      dispatch({ type: "tick", secondsRemaining: secondsUntil(deadline) })
    }

    // The countdown is anchored to the server deadline, so the first tick has to
    // measure it after mount rather than during render.
    update()
    const interval = window.setInterval(update, 1_000)
    return () => window.clearInterval(interval)
  }, [state.relockAt])

  useEffect(() => {
    if (
      state.status !== "unlocked" ||
      !state.measured ||
      state.relockAt === null ||
      state.secondsRemaining > 0
    ) return
    if (relockInFlight.current) return

    relockInFlight.current = true
    // The request begins after the countdown reaches zero; the server result
    // decides what the guest sees.
    dispatch({ type: "relockStarted" })

    void (async () => {
      try {
        const result = await relockShare(token)
        relockInFlight.current = false
        dispatch({ type: result.ok ? "relockSucceeded" : "relockFailed" })
      } catch {
        relockInFlight.current = false
        dispatch({ type: "relockFailed" })
      }
    })()
  }, [state.measured, state.relockAt, state.secondsRemaining, state.status, token])

  function handleUnlock() {
    dispatch({ type: "unlockStarted" })
    startTransition(async () => {
      try {
        const result = await redeemShare(token)
        if (!result.ok) {
          dispatch({
            type: "unlockFailed",
            message: getErrorMessage(result),
            terminal: TERMINAL_UNLOCK_REASONS.includes(result.reason),
          })
          return
        }

        const deadline = new Date(result.relockAt).getTime()
        dispatch({
          type: "unlockSucceeded",
          relockAt: deadline,
          secondsRemaining: secondsUntil(deadline),
          canUnlockAgain: result.canUnlockAgain,
        })
      } catch {
        dispatch({
          type: "unlockFailed",
          message: "We couldn't complete that request. Check your connection and try again.",
          terminal: false,
        })
      }
    })
  }

  const showStatus = state.status !== "idle"
  const isCoolingDown = state.relockAt !== null && state.secondsRemaining > 0
  const isRelocking = state.status === "relocking"
  const disabled =
    isRelocking ||
    isGuestUnlockDisabled({
      isPending,
      isCoolingDown: state.relockAt !== null,
      canUnlockAgain: state.canUnlockAgain,
    })

  return (
    <div className="space-y-4">
      {showStatus && (
        <div aria-live="polite" className="rounded-lg border border-emerald-700/20 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-300/20 dark:bg-emerald-950 dark:text-emerald-50" role="status">
          <p className="flex items-center gap-2 font-medium">
            <Check aria-hidden="true" className="size-4" />
            {relockOnly ? "Relocking locker" : "Locker unlocked"}
          </p>
          {state.status === "relocked" ? (
            <p className="mt-1 text-sm opacity-80">
              Locker relocked.{state.canUnlockAgain ? " You can unlock it again if needed." : " This link has no unlocks remaining."}
            </p>
          ) : state.status === "relock-failed" ? (
            <div className="mt-1 space-y-2">
              <p className="text-sm opacity-80">The locker didn&apos;t relock. Try again.</p>
              <Button
                onClick={() => dispatch({ type: "retryRelock" })}
                size="sm"
                type="button"
                variant="outline"
              >
                Try relock
              </Button>
            </div>
          ) : isRelocking || (state.relockAt !== null && state.secondsRemaining <= 0) ? (
            <p className="mt-1 text-sm opacity-80">Relocking…</p>
          ) : isCoolingDown ? (
            <p className="mt-1 text-sm opacity-80">
              It will relock automatically in <span aria-live="off" className="font-semibold tabular-nums">{state.secondsRemaining}</span> seconds.
            </p>
          ) : state.canUnlockAgain ? (
            <p className="mt-1 text-sm opacity-80">The locker should now be relocked. You can unlock it again if needed.</p>
          ) : (
            <p className="mt-1 text-sm opacity-80">This link has no unlocks remaining.</p>
          )}
        </div>
      )}

      {state.error && <p aria-live="polite" className="text-sm text-destructive-text" role="alert">{state.error}</p>}

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
          ) : state.relockAt !== null ? (
            <>
              <LockKeyholeOpen aria-hidden="true" className="size-5" />
              Unlocked
            </>
          ) : !state.canUnlockAgain ? (
            <>
              <LockKeyhole aria-hidden="true" className="size-5" />
              {showStatus ? "No unlocks remaining" : "Link unavailable"}
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
