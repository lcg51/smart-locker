"use client"

import { Battery, CircleHelp, LockKeyhole, LockKeyholeOpen, RefreshCw, Wifi, WifiOff } from "lucide-react"
import type { Locker as LockerRecord } from "@prisma/client"
import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import { formatEventTime } from "@/lib/events/presentation"
import { fill } from "@/lib/i18n/format"
import { useLockerCommand } from "@/hooks/use-locker-command"

export function LockerDetailControls({ locker }: { locker: LockerRecord }) {
  const { dictionary, locale } = useI18n()
  const {
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
          <h2 id="locker-controls-title" className="text-xl font-semibold">{dictionary.locker.controls}</h2>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-muted-foreground">
            <span aria-live="polite" className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-medium ${state.status === "unlocked" ? "bg-primary text-primary-foreground" : state.status === "locked" ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>
              <StatusIcon aria-hidden="true" className="size-4" />
              {dictionary.common.status[state.status]}
            </span>
            <span className="inline-flex items-center gap-2">
              <Battery aria-hidden="true" className="size-4" />
              {state.batteryLevel === null
                ? dictionary.common.batteryUnavailable
                : fill(dictionary.common.batteryLevel, { level: state.batteryLevel })}
            </span>
            <span className="inline-flex items-center gap-2">
              {state.online === false ? <WifiOff aria-hidden="true" className="size-4" /> : <Wifi aria-hidden="true" className="size-4" />}
              {state.online === null
                ? dictionary.common.checkingConnection
                : state.online
                  ? dictionary.common.online
                  : dictionary.common.offline}
            </span>
            <span>
              {locker.lastSyncedAt
                ? fill(dictionary.common.lastChecked, {
                  time: formatEventTime(locker.lastSyncedAt, locale),
                })
                : dictionary.common.notCheckedYet}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="min-h-11" disabled={isPending} onClick={() => runCommand(nextCommand)} type="button">
            {isPending ? nextPendingLabel : nextLabel}
          </Button>
          <Button className="min-h-11" onClick={() => void refreshState()} type="button" variant="outline">
            <RefreshCw aria-hidden="true" className="size-4" />
            {dictionary.common.refreshStatus}
          </Button>
        </div>
      </div>

      {refreshError && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2 text-sm" role="status">
          <span>{dictionary.common.statusRefreshFailed}</span>
          <Button className="min-h-11 shrink-0" onClick={() => void refreshState()} size="sm" type="button" variant="ghost">
            {dictionary.common.retryStatus}
          </Button>
        </div>
      )}

      {actionError && (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-3 text-sm" role="alert">
          <p>{actionError}</p>
          <Button className="mt-2 min-h-11 px-0" onClick={() => runCommand(retryCommand)} size="sm" type="button" variant="link">
            {dictionary.common.tryAgain}
          </Button>
        </div>
      )}
    </section>
  )
}
