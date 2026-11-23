"use client"

import { useState, useTransition } from "react"
import { setGuestUnlockEmails } from "@/app/actions/account"
import { useI18n } from "@/components/i18n-provider"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"

export function GuestUnlockEmailToggle({
  userId,
  initialEnabled,
}: {
  userId: string
  initialEnabled: boolean
}) {
  const { dictionary } = useI18n()
  const [enabled, setEnabled] = useState(initialEnabled)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleChange(nextEnabled: boolean) {
    const previousEnabled = enabled
    setEnabled(nextEnabled)
    setError(null)

    startTransition(async () => {
      try {
        await setGuestUnlockEmails(userId, nextEnabled)
        toast({ title: dictionary.settings.preferenceSaved })
      } catch {
        setEnabled(previousEnabled)
        setError(dictionary.settings.preferenceError)
      }
    })
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="font-medium" id="guest-unlock-email-label">{dictionary.settings.guestEmailsTitle}</p>
        <p className="text-sm text-muted-foreground" id="guest-unlock-email-description">
          {dictionary.settings.guestEmailsDescription}
        </p>
        {error ? (
          <p aria-live="polite" className="text-sm text-destructive-text" role="alert">{error}</p>
        ) : isPending ? (
          <p aria-live="polite" className="text-sm text-muted-foreground" role="status">{dictionary.common.saving}</p>
        ) : null}
      </div>
      <Switch
        aria-describedby="guest-unlock-email-description"
        aria-labelledby="guest-unlock-email-label"
        checked={enabled}
        disabled={isPending}
        onCheckedChange={handleChange}
      />
    </div>
  )
}
