"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CalendarClock, Users } from "lucide-react"
import { revokeShare } from "@/app/actions/shares"
import { Button } from "@/components/ui/button"
import type { ActiveShareGrant } from "@/lib/shares/service"
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

function formatExpiry(date: Date): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

export function ActiveShares({ grants }: { grants: ActiveShareGrant[] }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleRevoke(grantId: string) {
    setError(null)
    startTransition(async () => {
      try {
        const revoked = await revokeShare(grantId)
        if (!revoked) {
          setError("This share link is no longer active. Refresh the page and try again.")
          return
        }
        router.refresh()
      } catch {
        setError("Couldn't revoke this link. Try again.")
      }
    })
  }

  if (grants.length === 0) {
    return <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">No active share links.</p>
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      {grants.map((grant) => (
        <article className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between" key={grant.id}>
          <div className="min-w-0 space-y-2">
            <h3 className="truncate font-medium">{grant.guestLabel || "Guest"}</h3>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <CalendarClock aria-hidden="true" className="size-4" />
                Expires {formatExpiry(grant.expiresAt)}
              </span>
              <span className="inline-flex items-center gap-2">
                <Users aria-hidden="true" className="size-4" />
                {grant.usedCount} of {grant.maxUses} unlocks used
              </span>
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="min-h-11 shrink-0" disabled={isPending} type="button" variant="outline">
                Revoke
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revoke this share link?</AlertDialogTitle>
                <AlertDialogDescription>
                  {grant.guestLabel || "This guest"} will no longer be able to unlock {" "}
                  {grant.guestLabel ? "this locker" : "the locker"} with this link.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="min-h-11">Keep link</AlertDialogCancel>
                <AlertDialogAction className="min-h-11" onClick={() => handleRevoke(grant.id)}>
                  {isPending ? "Revoking…" : "Revoke link"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </article>
      ))}
    </div>
  )
}
