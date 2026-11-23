"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, Link2, QrCode, Share2, X } from "lucide-react"
import { createShare } from "@/app/actions/shares"
import type { CreateShareResult } from "@/app/actions/shares"
import { useI18n } from "@/components/i18n-provider"
import { ShareQr } from "@/components/share-qr"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { fill } from "@/lib/i18n/format"
import type { Dictionary } from "@/lib/i18n/dictionaries"

type CreatedShare = { url: string; grantId: string }
type CopyStatus = "copied" | "error" | null

function shareErrorMessage(
  error: Extract<CreateShareResult, { ok: false }>["error"],
  dictionary: Dictionary,
): string {
  if (error === "rate_limited") return dictionary.share.rateLimited
  if (error === "share_limit_reached") return dictionary.share.shareLimit
  if (error === "sharing_disabled") return dictionary.share.sharingPaused
  return dictionary.share.createError
}

export function ShareDialog({ lockerId, lockerName }: { lockerId: string; lockerName: string }) {
  const router = useRouter()
  const { dictionary } = useI18n()
  const [open, setOpen] = useState(false)
  const [createdShare, setCreatedShare] = useState<CreatedShare | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>(null)
  const [showQr, setShowQr] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setCreatedShare(null)
      setError(null)
      setCopyStatus(null)
      setShowQr(false)
    }
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      try {
        const result = await createShare(lockerId, formData)
        if (!result.ok) {
          setError(shareErrorMessage(result.error, dictionary))
          return
        }

        setCreatedShare({ url: result.url, grantId: result.grantId })
        router.refresh()
      } catch {
        setError(dictionary.share.createError)
      }
    })
  }

  async function copyShareUrl() {
    if (!createdShare) return
    try {
      await navigator.clipboard.writeText(createdShare.url)
      setCopyStatus("copied")
    } catch {
      setCopyStatus("error")
    }
  }

  async function shareLink() {
    if (!createdShare) return
    setError(null)

    if (typeof navigator === "undefined" || !navigator.share) {
      setError(dictionary.share.sharingUnavailable)
      return
    }

    try {
      await navigator.share({
        title: dictionary.share.shareTitle,
        text: fill(dictionary.share.shareText, { locker: lockerName }),
        url: createdShare.url,
      })
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return
      setError(dictionary.share.sharingUnavailable)
    }
  }

  const canShare = typeof navigator !== "undefined" && "share" in navigator

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="min-h-11 shrink-0">
          <Link2 aria-hidden="true" className="size-4" />
          {dictionary.share.shareAccess}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md" showCloseButton={false}>
        <DialogClose asChild>
          <Button aria-label={dictionary.share.closeDialog} className="absolute right-3 top-3 size-11" size="icon" type="button" variant="ghost">
            <X aria-hidden="true" className="size-4" />
          </Button>
        </DialogClose>
        <DialogHeader className="pr-10">
          <DialogTitle>{fill(dictionary.share.dialogTitle, { locker: lockerName })}</DialogTitle>
          <DialogDescription>{dictionary.share.dialogDescription}</DialogDescription>
        </DialogHeader>

        {createdShare ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{dictionary.share.ready}</p>
            <div className="space-y-2">
              <Label htmlFor="share-url">{dictionary.share.linkLabel}</Label>
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
              {copyStatus === "copied" ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
              {copyStatus === "copied" ? dictionary.share.copied : dictionary.share.copyLink}
            </Button>
            {copyStatus && (
              <p aria-live="polite" className="text-sm text-muted-foreground">
                {copyStatus === "copied" ? dictionary.share.linkCopied : dictionary.share.copyUnavailable}
              </p>
            )}

            {error && <p className="text-sm text-destructive-text" role="alert">{error}</p>}

            <div className="grid gap-2 sm:grid-cols-2">
              {canShare && (
                <Button className="min-h-11" onClick={shareLink} type="button" variant="outline">
                  <Share2 aria-hidden="true" className="size-4" />
                  {dictionary.share.share}
                </Button>
              )}
              <Button
                aria-controls="share-qr"
                aria-expanded={showQr}
                className="min-h-11"
                onClick={() => setShowQr((visible) => !visible)}
                type="button"
                variant="outline"
              >
                <QrCode aria-hidden="true" className="size-4" />
                {showQr ? dictionary.share.hideQr : dictionary.share.showQr}
              </Button>
            </div>

            {showQr && (
              <div className="space-y-2" id="share-qr">
                <ShareQr url={createdShare.url} />
                <p className="text-center text-sm text-muted-foreground">{dictionary.share.qrHint}</p>
              </div>
            )}
          </div>
        ) : (
          <form action={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="guestLabel">
                {dictionary.share.guestLabel}{" "}
                <span className="font-normal text-muted-foreground">{dictionary.common.optional}</span>
              </Label>
              <Input autoComplete="off" className="min-h-11" id="guestLabel" maxLength={80} name="guestLabel" placeholder={dictionary.share.guestLabelPlaceholder} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="durationMinutes">{dictionary.share.expiresAfter}</Label>
              <select
                className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                defaultValue="60"
                id="durationMinutes"
                name="durationMinutes"
              >
                <option value="15">{dictionary.share.minutes15}</option>
                <option value="60">{dictionary.share.hour1}</option>
                <option value="240">{dictionary.share.hours4}</option>
                <option value="1440">{dictionary.share.hours24}</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxUses">{dictionary.share.maxUnlocks}</Label>
              <Input className="min-h-11" defaultValue={5} id="maxUses" max={50} min={1} name="maxUses" required type="number" />
              <p className="text-sm text-muted-foreground">{dictionary.share.maxUnlocksHint}</p>
            </div>

            {error && <p className="text-sm text-destructive-text" role="alert">{error}</p>}

            <Button className="min-h-11 w-full" disabled={isPending} type="submit">
              {isPending ? dictionary.share.creating : dictionary.share.createLink}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
