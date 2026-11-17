"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { revokeOtherSessionsAction } from "@/app/actions/account"
import { Button } from "@/components/ui/button"
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
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleRevoke() {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      try {
        const result = await revokeOtherSessionsAction()
        setMessage(result.revoked > 0 ? "Other sessions revoked." : "No other sessions to revoke.")
        router.refresh()
      } catch {
        setError("Couldn't revoke other sessions. Try again.")
      }
    })
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {sessions.map((session) => (
          <li className="rounded-md border p-3" key={session.id}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{session.isCurrent ? "This device" : "Another device"}</p>
              {session.isCurrent && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                  Current
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{session.deviceLabel ?? "Unknown device"}</p>
            <p className="text-sm text-muted-foreground">Created {session.createdAt}</p>
            <p className="text-sm text-muted-foreground">Expires {session.expires}</p>
            <p className="text-sm text-muted-foreground">
              Approximate location: {session.locationLabel ?? "unavailable"}
            </p>
          </li>
        ))}
      </ul>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button className="min-h-11" disabled={isPending} type="button" variant="outline">
            Revoke other sessions
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke other sessions?</AlertDialogTitle>
            <AlertDialogDescription>
              This signs out every other browser. This device stays signed in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="min-h-11" disabled={isPending} onClick={handleRevoke}>
              {isPending ? "Revoking…" : "Revoke other sessions"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {message && <p aria-live="polite" className="text-sm text-muted-foreground" role="status">{message}</p>}
      {error && <p aria-live="polite" className="text-sm text-destructive-text" role="alert">{error}</p>}
    </div>
  )
}
