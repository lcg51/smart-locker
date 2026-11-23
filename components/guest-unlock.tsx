"use client"

import { useEffect, useReducer, useRef, useTransition } from "react"
import { Check, LockKeyhole, LockKeyholeOpen } from "lucide-react"
import { redeemShare, relockShare } from "@/app/share/[token]/actions"
import type { GuestRedeemResult } from "@/app/share/[token]/actions"
import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import type { Dictionary } from "@/lib/i18n/dictionaries"
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
  "sharing_disabled",
  "commands_disabled",
]

function parseDeadline(value: string | null | undefined): number | null {
  if (!value) return null
  const deadline = Date.parse(value)
  return Number.isNaN(deadline) ? null : deadline
}

function secondsUntil(deadline: number): number {
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1_000))
}

function getErrorMessage(
  result: Extract<GuestRedeemResult, { ok: false }>,
  dictionary: Dictionary,
): string {
  if (result.reason === "rate_limited") return dictionary.share.errorRateLimited
  if (result.reason === "lock_failed") return dictionary.share.errorLockFailed
  return dictionary.share.errorUnavailable
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
  const { dictionary } = useI18n()
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
            message: getErrorMessage(result, dictionary),
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
          message: dictionary.share.errorNetwork,
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
            {relockOnly ? dictionary.share.relockingLocker : dictionary.share.unlockedTitle}
          </p>
          {state.status === "relocked" ? (
            <p className="mt-1 text-sm opacity-80">
              {dictionary.share.relocked}
              {state.canUnlockAgain
                ? dictionary.share.canUnlockAgain
                : dictionary.share.noUnlocksRemainingInline}
            </p>
          ) : state.status === "relock-failed" ? (
            <div className="mt-1 space-y-2">
              <p className="text-sm opacity-80">{dictionary.share.relockFailed}</p>
              <Button
                onClick={() => dispatch({ type: "retryRelock" })}
                size="sm"
                type="button"
                variant="outline"
              >
                {dictionary.share.tryRelock}
              </Button>
            </div>
          ) : isRelocking || (state.relockAt !== null && state.secondsRemaining <= 0) ? (
            <p className="mt-1 text-sm opacity-80">{dictionary.share.relocking}</p>
          ) : isCoolingDown ? (
            <p className="mt-1 text-sm opacity-80">
              {dictionary.share.relockCountdownBefore}
              <span aria-live="off" className="font-semibold tabular-nums">{state.secondsRemaining}</span>
              {dictionary.share.relockCountdownAfter}
            </p>
          ) : state.canUnlockAgain ? (
            <p className="mt-1 text-sm opacity-80">{dictionary.share.relockedNow}</p>
          ) : (
            <p className="mt-1 text-sm opacity-80">{dictionary.share.noUnlocksRemaining}</p>
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
              {dictionary.share.unlocking}
            </>
          ) : state.relockAt !== null ? (
            <>
              <LockKeyholeOpen aria-hidden="true" className="size-5" />
              {dictionary.share.unlockedButton}
            </>
          ) : !state.canUnlockAgain ? (
            <>
              <LockKeyhole aria-hidden="true" className="size-5" />
              {showStatus ? dictionary.share.noUnlocksRemaining : dictionary.share.linkUnavailable}
            </>
          ) : (
            <>
              <LockKeyhole aria-hidden="true" className="size-5" />
              {dictionary.share.unlockLocker}
            </>
          )}
        </Button>
      )}
    </div>
  )
}
