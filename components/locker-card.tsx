"use client"

import { Battery, ChevronRight, CircleHelp, LockKeyhole, LockKeyholeOpen, Wifi, WifiOff } from "lucide-react"
import type { Locker as LockerRecord } from "@prisma/client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { statusLabels, useLockerCommand } from "@/hooks/use-locker-command"

export function LockerCard({ locker }: { locker: LockerRecord }) {
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
