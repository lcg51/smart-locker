"use client"

import { Battery, CircleHelp, LockKeyhole, LockKeyholeOpen, RefreshCw, Wifi, WifiOff } from "lucide-react"
import type { Locker as LockerRecord } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { formatEventTime } from "@/lib/events/presentation"
import { statusLabels, useLockerCommand } from "@/hooks/use-locker-command"

export function LockerDetailControls({ locker }: { locker: LockerRecord }) {
  const {
    state,
    isPending,
    actionError,
    refreshError,
    retryCommand,
    nextCommand,
    nextLabel,
    runCommand,
    refreshState,
  } = useLockerCommand(locker)

  const StatusIcon = state.status === "locked"
    ? LockKeyhole
    : state.status === "unlocked"
      ? LockKeyholeOpen
      : CircleHelp

  return (
    <section aria-labelledby="locker-controls-title" className="mt-8 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 id="locker-controls-title" className="text-xl font-semibold">Controls</h2>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-muted-foreground">
            <span aria-live="polite" className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-medium ${state.status === "unlocked" ? "bg-primary text-primary-foreground" : state.status === "locked" ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>
              <StatusIcon aria-hidden="true" className="size-4" />
              {statusLabels[state.status]}
            </span>
            <span className="inline-flex items-center gap-2">
              <Battery aria-hidden="true" className="size-4" />
              {state.batteryLevel === null ? "Battery unavailable" : `${state.batteryLevel}% battery`}
            </span>
            <span className="inline-flex items-center gap-2">
              {state.online === false ? <WifiOff aria-hidden="true" className="size-4" /> : <Wifi aria-hidden="true" className="size-4" />}
              {state.online === null ? "Checking connection" : state.online ? "Online" : "Offline"}
            </span>
            <span>
              {locker.lastSyncedAt
                ? `Last checked ${formatEventTime(locker.lastSyncedAt)}`
                : "Not checked yet"}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="min-h-11" disabled={isPending} onClick={() => runCommand(nextCommand)} type="button">
            {isPending ? `${nextLabel}ing…` : nextLabel}
          </Button>
          <Button className="min-h-11" onClick={() => void refreshState()} type="button" variant="outline">
            <RefreshCw aria-hidden="true" className="size-4" />
            Refresh status
          </Button>
        </div>
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
    </section>
  )
}
