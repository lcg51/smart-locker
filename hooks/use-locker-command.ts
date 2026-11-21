"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Locker as LockerRecord } from "@prisma/client"
import { lockLocker, unlockLocker } from "@/app/actions/lockers"
import type { LockStatusValue, LockerState } from "@/lib/locks/types"

export type DisplayState = Omit<LockerState, "online"> & {
  status: "locked" | "unlocked" | "unknown"
  online: boolean | null
}

export type Command = "lock" | "unlock"

// Mirrors LOCK_STATE_CACHE_SECONDS (server default 30). Returning to the tab
// only refreshes when the stored state is older than this.
const STATE_CACHE_MS = 30_000

export const statusLabels: Record<DisplayState["status"], string> = {
  locked: "Locked",
  unlocked: "Unlocked",
  unknown: "Status unknown",
}

export function displayStatus(status: LockerRecord["status"] | LockStatusValue): DisplayState["status"] {
  if (status === "LOCKED" || status === "locked") return "locked"
  if (status === "UNLOCKED" || status === "unlocked") return "unlocked"
  return "unknown"
}

export function lockerCommandErrorMessage(errorCode: string | undefined, command: Command): string {
  if (errorCode === "not_found") return "This locker is no longer available."
  if (errorCode === "rate_limited") return "Too many attempts. Wait a minute and try again."
  if (errorCode === "commands_disabled") return "Unlock is paused. You can still lock the locker."
  if (errorCode === "quota_exceeded") {
    return "Locker commands are paused until the monthly connection limit resets. Try again next month."
  }
  return `Couldn't ${command} this locker. Check its connection and try again.`
}

export function useLockerCommand(locker: LockerRecord) {
  const router = useRouter()
  const [state, setState] = useState<DisplayState>({
    status: displayStatus(locker.status),
    batteryLevel: locker.batteryLevel,
    online: null,
  })
  const [actionError, setActionError] = useState<string | null>(null)
  const [refreshError, setRefreshError] = useState(false)
  const [retryCommand, setRetryCommand] = useState<Command>("unlock")
  const [isPending, startTransition] = useTransition()
  const refreshInFlight = useRef(false)

  const refreshState = useCallback(async (signal?: AbortSignal) => {
    if (refreshInFlight.current) return
    refreshInFlight.current = true

    try {
      const response = await fetch(`/api/lockers/${locker.id}/state`, {
        cache: "no-store",
        signal,
      })
      if (!response.ok) throw new Error("Unable to refresh locker state")

      const data = await response.json() as LockerState
      setState({ ...data, status: displayStatus(data.status) })
      setRefreshError(false)
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) return
      setRefreshError(true)
    } finally {
      refreshInFlight.current = false
    }
  }, [locker.id])

  useEffect(() => {
    const controller = new AbortController()
    // One read on mount; no background polling. The server cache absorbs
    // repeated opens within its TTL.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshState(controller.signal)

    return () => {
      controller.abort()
    }
  }, [refreshState])

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return
      const lastSynced = locker.lastSyncedAt ? new Date(locker.lastSyncedAt).getTime() : 0
      if (Date.now() - lastSynced >= STATE_CACHE_MS) void refreshState()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [locker.lastSyncedAt, refreshState])

  function runCommand(command: Command) {
    setRetryCommand(command)
    setActionError(null)
    startTransition(async () => {
      const result = command === "unlock"
        ? await unlockLocker(locker.id)
        : await lockLocker(locker.id)

      if (!result.ok) {
        setActionError(lockerCommandErrorMessage(result.errorCode, command))
        return
      }

      if (result.state) setState({ ...result.state, status: displayStatus(result.state.status) })
      setRefreshError(false)
      router.refresh()
    })
  }

  const nextCommand: Command = state.status === "unlocked" ? "lock" : "unlock"
  const nextLabel = nextCommand === "unlock" ? "Unlock" : "Lock"

  return {
    state,
    isPending,
    actionError,
    refreshError,
    retryCommand,
    nextCommand,
    nextLabel,
    runCommand,
    refreshState,
  }
}
