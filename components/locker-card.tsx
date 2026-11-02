"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Battery, ChevronRight, CircleHelp, LockKeyhole, LockKeyholeOpen, Wifi, WifiOff } from "lucide-react"
import type { Locker as LockerRecord } from "@prisma/client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { lockLocker, unlockLocker } from "@/app/actions/lockers"
import type { LockStatusValue, LockerState } from "@/lib/locks/types"

type DisplayState = Omit<LockerState, "online"> & {
  status: "locked" | "unlocked" | "unknown"
  online: boolean | null
}
type Command = "lock" | "unlock"

const statusLabels: Record<DisplayState["status"], string> = {
  locked: "Locked",
  unlocked: "Unlocked",
  unknown: "Status unknown",
}

function displayStatus(status: LockerRecord["status"] | LockStatusValue): DisplayState["status"] {
  if (status === "LOCKED" || status === "locked") return "locked"
  if (status === "UNLOCKED" || status === "unlocked") return "unlocked"
  return "unknown"
}

function messageForError(errorCode: string | undefined, command: Command): string {
  if (errorCode === "not_found") return "This locker is no longer available."
  return `Couldn't ${command} this locker. Check its connection and try again.`
}

export function LockerCard({ locker }: { locker: LockerRecord }) {
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
        setActionError(messageForError(result.errorCode, command))
        return
      }

      if (result.state) setState({ ...result.state, status: displayStatus(result.state.status) })
      setRefreshError(false)
      router.refresh()
    })
  }

  const nextCommand: Command = state.status === "unlocked" ? "lock" : "unlock"
  const nextLabel = nextCommand === "unlock" ? "Unlock" : "Lock"
  const StatusIcon = state.status === "locked"
    ? LockKeyhole
    : state.status === "unlocked"
      ? LockKeyholeOpen
      : CircleHelp

  return (
    <article aria-labelledby={`locker-${locker.id}-name`} className="flex h-full flex-col rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <StatusIcon className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 id={`locker-${locker.id}-name`} className="truncate text-lg font-semibold">{locker.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Apartment locker</p>
          </div>
        </div>
        <span aria-live="polite" className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${state.status === "unlocked" ? "bg-primary text-primary-foreground" : state.status === "locked" ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>
          {statusLabels[state.status]}
        </span>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <Battery aria-hidden="true" className="size-4" />
          {state.batteryLevel === null ? "Battery unavailable" : `${state.batteryLevel}% battery`}
        </span>
        <span className="inline-flex items-center gap-2">
          {state.online === false ? <WifiOff aria-hidden="true" className="size-4" /> : <Wifi aria-hidden="true" className="size-4" />}
          {state.online === null ? "Checking connection" : state.online ? "Online" : "Offline"}
        </span>
      </div>

      {refreshError && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2 text-sm" role="status">
          <span>Status couldn&apos;t be refreshed.</span>
          <Button className="min-h-11 shrink-0" onClick={() => void refreshState()} size="sm" type="button" variant="ghost">
            Retry status
          </Button>
        </div>
      )}

      {actionError && (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-3 text-sm" role="alert">
          <p>{actionError}</p>
          <Button className="mt-2 min-h-11 px-0" onClick={() => runCommand(retryCommand)} size="sm" type="button" variant="link">
            Try again
          </Button>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-3 pt-6">
        <Button className="min-h-11 w-full" disabled={isPending} onClick={() => runCommand(nextCommand)} type="button">
          {isPending ? `${nextLabel}ing…` : nextLabel}
        </Button>
        <Link
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          href={`/dashboard/lockers/${locker.id}`}
        >
          Locker details <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </article>
  )
}
