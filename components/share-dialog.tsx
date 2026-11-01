"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, Link2, X } from "lucide-react"
import { createShare } from "@/app/actions/shares"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type CreatedShare = { url: string; grantId: string }

export function ShareDialog({ lockerId, lockerName }: { lockerId: string; lockerName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [createdShare, setCreatedShare] = useState<CreatedShare | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setCreatedShare(null)
      setError(null)
      setCopyMessage(null)
    }
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      try {
        const result = await createShare(lockerId, formData)
        setCreatedShare(result)
        router.refresh()
      } catch {
        setError("Couldn't create a share link. Check the values and try again.")
      }
    })
  }

  async function copyShareUrl() {
    if (!createdShare) return
    try {
      await navigator.clipboard.writeText(createdShare.url)
      setCopyMessage("Link copied")
    } catch {
      setCopyMessage("Copy unavailable. Select and copy the link above.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="min-h-11 shrink-0">
          <Link2 aria-hidden="true" className="size-4" />
          Share access
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md" showCloseButton={false}>
        <DialogClose asChild>
          <Button aria-label="Close share dialog" className="absolute right-3 top-3 size-11" size="icon" type="button" variant="ghost">
            <X aria-hidden="true" className="size-4" />
          </Button>
        </DialogClose>
        <DialogHeader className="pr-10">
          <DialogTitle>Share {lockerName}</DialogTitle>
          <DialogDescription>Create a temporary link for a guest. You can revoke it at any time.</DialogDescription>
        </DialogHeader>

        {createdShare ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Your link is ready. Copy it now; it won't be shown again after you close this dialog.</p>
            <div className="space-y-2">
              <Label htmlFor="share-url">Share link</Label>
              <Input
                data-testid="share-url"
                id="share-url"
                className="min-h-11"
                onFocus={(event) => event.currentTarget.select()}
                readOnly
                value={createdShare.url}
              />
            </div>
            <Button className="min-h-11 w-full" onClick={copyShareUrl} type="button" variant="secondary">
              {copyMessage === "Link copied" ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
              {copyMessage === "Link copied" ? "Copied" : "Copy link"}
            </Button>
            {copyMessage && <p aria-live="polite" className="text-sm text-muted-foreground">{copyMessage}</p>}
          </div>
        ) : (
          <form action={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="guestLabel">Guest label <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input autoComplete="off" className="min-h-11" id="guestLabel" maxLength={80} name="guestLabel" placeholder="e.g. Cleaner" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="durationMinutes">Link expires after</Label>
              <select
                className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                defaultValue="60"
                id="durationMinutes"
                name="durationMinutes"
              >
                <option value="15">15 minutes</option>
                <option value="60">1 hour</option>
                <option value="240">4 hours</option>
                <option value="1440">24 hours</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxUses">Maximum unlocks</Label>
              <Input className="min-h-11" defaultValue={5} id="maxUses" max={50} min={1} name="maxUses" required type="number" />
              <p className="text-sm text-muted-foreground">Choose from 1 to 50 unlocks.</p>
            </div>

            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

            <Button className="min-h-11 w-full" disabled={isPending} type="submit">
              {isPending ? "Creating link…" : "Create share link"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
