"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CalendarPlus } from "lucide-react"
import { extendShare } from "@/app/actions/shares"
import type { ExtendShareResult } from "@/app/actions/shares"
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
import { formatEventTime } from "@/lib/events/presentation"
import type { ActiveShareGrant } from "@/lib/shares/service"

function errorMessage(error: Extract<ExtendShareResult, { ok: false }>["error"]): string {
  if (error === "not_found") return "This link is no longer available."
  if (error === "revoked") return "This link was revoked. Create a new one."
  if (error === "expired") return "This link has expired. Create a new one."
  return "Add at least one positive number of minutes or unlocks."
}

export function ExtendShareDialog({ grant }: { grant: ActiveShareGrant }) {
  const router = useRouter()
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
          setError(errorMessage(result.error))
          return
        }
        setOpen(false)
        router.refresh()
      } catch {
        setError("Couldn't extend this link. Try again.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="min-h-11 shrink-0" disabled={isPending} type="button" variant="outline">
          <CalendarPlus aria-hidden="true" className="size-4" />
          Extend
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Extend share link</DialogTitle>
          <DialogDescription>
            Add time or unlocks to {grant.guestLabel || "this guest"}&apos;s link.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          <p>Expires {formatEventTime(grant.expiresAt)}</p>
          <p>{grant.usedCount} of {grant.maxUses} unlocks used</p>
        </div>

        <form action={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="additionalMinutes">Additional minutes</Label>
              <Input
                className="min-h-11"
                id="additionalMinutes"
                inputMode="numeric"
                max={1440}
                min={15}
                name="additionalMinutes"
                placeholder="e.g. 30"
                type="number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="additionalUses">Additional unlocks</Label>
              <Input
                className="min-h-11"
                id="additionalUses"
                inputMode="numeric"
                max={50}
                min={1}
                name="additionalUses"
                placeholder="e.g. 2"
                type="number"
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Add at least one value. Links cap at 24 hours from now and 50 total unlocks.
          </p>

          {error && <p className="text-sm text-destructive-text" role="alert">{error}</p>}

          <Button className="min-h-11 w-full" disabled={isPending} type="submit">
            {isPending ? "Extending…" : "Extend link"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
