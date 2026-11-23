"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CalendarPlus } from "lucide-react"
import { extendShare } from "@/app/actions/shares"
import type { ExtendShareResult } from "@/app/actions/shares"
import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { formatEventTime } from "@/lib/events/presentation"
import { fill } from "@/lib/i18n/format"
import type { Dictionary } from "@/lib/i18n/dictionaries"
import type { ActiveShareGrant } from "@/lib/shares/service"

function errorMessage(
  error: Extract<ExtendShareResult, { ok: false }>["error"],
  dictionary: Dictionary,
): string {
  if (error === "not_found") return dictionary.share.extendNotFound
  if (error === "revoked") return dictionary.share.extendRevoked
  if (error === "expired") return dictionary.share.extendExpired
  return dictionary.share.extendInvalid
}

export function ExtendShareDialog({ grant }: { grant: ActiveShareGrant }) {
  const router = useRouter()
  const { dictionary, locale } = useI18n()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) setError(null)
  }

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      try {
        const result = await extendShare(grant.id, formData)
        if (!result.ok) {
          setError(errorMessage(result.error, dictionary))
          return
        }
        toast({ title: dictionary.share.extended })
        setOpen(false)
        router.refresh()
      } catch {
        setError(dictionary.share.extendFailed)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="min-h-11 shrink-0" disabled={isPending} type="button" variant="outline">
          <CalendarPlus aria-hidden="true" className="size-4" />
          {dictionary.share.extend}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md" closeLabel={dictionary.common.close}>
        <DialogHeader>
          <DialogTitle>{dictionary.share.extendTitle}</DialogTitle>
          <DialogDescription>
            {fill(dictionary.share.extendBody, { guest: grant.guestLabel || dictionary.share.thisGuest })}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          <p>{fill(dictionary.share.expiresAt, { time: formatEventTime(grant.expiresAt, locale) })}</p>
          <p>{fill(dictionary.share.unlocksUsed, { used: grant.usedCount, max: grant.maxUses })}</p>
        </div>

        <form action={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="additionalMinutes">{dictionary.share.extendMinutes}</Label>
              <Input
                className="min-h-11"
                id="additionalMinutes"
                inputMode="numeric"
                max={1440}
                min={15}
                name="additionalMinutes"
                placeholder={dictionary.share.extendMinutesPlaceholder}
                type="number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="additionalUses">{dictionary.share.extendUses}</Label>
              <Input
                className="min-h-11"
                id="additionalUses"
                inputMode="numeric"
                max={50}
                min={1}
                name="additionalUses"
                placeholder={dictionary.share.extendUsesPlaceholder}
                type="number"
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{dictionary.share.extendHint}</p>

          {error && <p className="text-sm text-destructive-text" role="alert">{error}</p>}

          <Button className="min-h-11 w-full" disabled={isPending} type="submit">
            {isPending ? dictionary.share.extending : dictionary.share.extendSubmit}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
