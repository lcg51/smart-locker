"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CalendarClock, Users } from "lucide-react"
import { revokeShare } from "@/app/actions/shares"
import { ExtendShareDialog } from "@/components/extend-share-dialog"
import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import type { ActiveShareGrant } from "@/lib/shares/service"
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

export function ActiveShares({ grants }: { grants: ActiveShareGrant[] }) {
  const router = useRouter()
  const { dictionary, locale } = useI18n()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function formatExpiry(date: Date): string {
    return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Madrid",
    }).format(date)
  }

  function handleRevoke(grantId: string) {
    setError(null)
    startTransition(async () => {
      try {
        const revoked = await revokeShare(grantId)
        if (!revoked) {
          setError(dictionary.share.revokeError)
          return
        }
        router.refresh()
      } catch {
        setError(dictionary.share.revokeFailed)
      }
    })
  }

  if (grants.length === 0) {
    return <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{dictionary.share.activeEmpty}</p>
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive-text" role="alert">{error}</p>}
      {grants.map((grant) => (
        <article className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between" key={grant.id}>
          <div className="min-w-0 space-y-2">
            <h3 className="truncate font-medium">{grant.guestLabel || dictionary.common.guest}</h3>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <CalendarClock aria-hidden="true" className="size-4" />
                {fill(dictionary.share.expiresAt, { time: formatExpiry(grant.expiresAt) })}
              </span>
              <span className="inline-flex items-center gap-2">
                <Users aria-hidden="true" className="size-4" />
                {fill(dictionary.share.unlocksUsed, {
                  used: grant.usedCount,
                  max: grant.maxUses,
                })}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
            <ExtendShareDialog grant={grant} />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="min-h-11 shrink-0" disabled={isPending} type="button" variant="outline">
                  {dictionary.share.revoke}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{dictionary.share.revokeTitle}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {fill(dictionary.share.revokeBody, {
                      guest: grant.guestLabel || dictionary.share.thisGuest,
                      locker: grant.guestLabel ? dictionary.share.thisLocker : dictionary.share.theLocker,
                    })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="min-h-11">{dictionary.share.keepLink}</AlertDialogCancel>
                  <AlertDialogAction className="min-h-11" onClick={() => handleRevoke(grant.id)}>
                    {isPending ? dictionary.share.revoking : dictionary.share.revokeLink}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </article>
      ))}
    </div>
  )
}
