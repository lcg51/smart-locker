"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { revokeOtherSessionsAction } from "@/app/actions/account"
import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { fill } from "@/lib/i18n/format"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export type SessionRow = {
  id: string
  createdAt: string
  expires: string
  isCurrent: boolean
  deviceLabel: string | null
  locationLabel: string | null
}

export function SessionList({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter()
  const { dictionary } = useI18n()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleRevoke() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await revokeOtherSessionsAction()
        toast({
          title: result.revoked > 0
            ? dictionary.settings.othersRevoked
            : dictionary.settings.noneToRevoke,
        })
        router.refresh()
      } catch {
        setError(dictionary.settings.revokeOthersFailed)
      }
    })
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {sessions.map((session) => (
          <li className="rounded-md border p-3" key={session.id}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">
                {session.isCurrent ? dictionary.settings.thisDevice : dictionary.settings.anotherDevice}
              </p>
              {session.isCurrent && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                  {dictionary.settings.current}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{session.deviceLabel ?? dictionary.settings.unknownDevice}</p>
            <p className="text-sm text-muted-foreground">
              {fill(dictionary.settings.created, { time: session.createdAt })}
            </p>
            <p className="text-sm text-muted-foreground">
              {fill(dictionary.settings.expires, { time: session.expires })}
            </p>
            <p className="text-sm text-muted-foreground">
              {fill(dictionary.settings.approximateLocation, {
                location: session.locationLabel ?? dictionary.settings.unavailable,
              })}
            </p>
          </li>
        ))}
      </ul>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button className="min-h-11" disabled={isPending} type="button" variant="outline">
            {dictionary.settings.revokeOthers}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dictionary.settings.revokeOthersTitle}</AlertDialogTitle>
            <AlertDialogDescription>{dictionary.settings.revokeOthersBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={isPending}>{dictionary.common.cancel}</AlertDialogCancel>
            <AlertDialogAction className="min-h-11" disabled={isPending} onClick={handleRevoke}>
              {isPending ? dictionary.settings.revoking : dictionary.settings.revokeOthers}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {error && <p aria-live="polite" className="text-sm text-destructive-text" role="alert">{error}</p>}
    </div>
  )
}
