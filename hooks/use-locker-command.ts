"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Locker as LockerRecord } from "@prisma/client"
import { lockLocker, unlockLocker } from "@/app/actions/lockers"
import { useI18n } from "@/components/i18n-provider"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import type { LockStatusValue, LockerState } from "@/lib/locks/types"

export type DisplayState = Omit<LockerState, "online"> & {
  status: "locked" | "unlocked" | "unknown"
  online: boolean | null
}

export type Command = "lock" | "unlock"

export function displayStatus(status: LockerRecord["status"] | LockStatusValue): DisplayState["status"] {
  if (status === "LOCKED" || status === "locked") return "locked"
  if (status === "UNLOCKED" || status === "unlocked") return "unlocked"
  return "unknown"
}

export function lockerCommandErrorMessage(
  errorCode: string | undefined,
  command: Command,
  dictionary: Dictionary,
): string {
  if (errorCode === "not_found") return dictionary.common.commandErrors.notFound
  if (errorCode === "rate_limited") return dictionary.common.commandErrors.rateLimited
  if (errorCode === "commands_disabled") return dictionary.common.commandErrors.commandsDisabled
  return command === "unlock"
    ? dictionary.common.commandErrors.unlockFailed
    : dictionary.common.commandErrors.lockFailed
}

export function useLockerCommand(locker: LockerRecord) {
  const router = useRouter()
  const { dictionary } = useI18n()
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
    // Initial polling starts after mount; the async update is not a render-time setState.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshState(controller.signal)
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshState(controller.signal)
    }, 30_000)

    return () => {
      window.clearInterval(interval)
      controller.abort()
    }
  }, [refreshState])

  function runCommand(command: Command) {
    setRetryCommand(command)
    setActionError(null)
    startTransition(async () => {
      const result = command === "unlock"
        ? await unlockLocker(locker.id)
        : await lockLocker(locker.id)

      if (!result.ok) {
        setActionError(lockerCommandErrorMessage(result.errorCode, command, dictionary))
        return
      }

      if (result.state) setState({ ...result.state, status: displayStatus(result.state.status) })
      setRefreshError(false)
      router.refresh()
    })
  }

  const nextCommand: Command = state.status === "unlocked" ? "lock" : "unlock"
  const nextLabel = nextCommand === "unlock" ? dictionary.common.unlock : dictionary.common.lock
  const nextPendingLabel = nextCommand === "unlock"
    ? dictionary.common.unlocking
    : dictionary.common.locking

  return {
    state,
    isPending,
    actionError,
    refreshError,
    retryCommand,
    nextCommand,
    nextLabel,
    nextPendingLabel,
    runCommand,
    refreshState,
  }
}
