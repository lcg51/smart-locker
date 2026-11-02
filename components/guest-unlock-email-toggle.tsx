"use client"

import { useState, useTransition } from "react"
import { setGuestUnlockEmails } from "@/app/actions/account"
import { Switch } from "@/components/ui/switch"

export function GuestUnlockEmailToggle({
  userId,
  initialEnabled,
}: {
  userId: string
  initialEnabled: boolean
}) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleChange(nextEnabled: boolean) {
    const previousEnabled = enabled
    setEnabled(nextEnabled)
    setError(null)
    setSaved(false)

    startTransition(async () => {
      try {
        await setGuestUnlockEmails(userId, nextEnabled)
        setSaved(true)
      } catch {
        setEnabled(previousEnabled)
        setError("Couldn't save this preference. Try again.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="font-medium" id="guest-unlock-email-label">Guest unlock emails</p>
        <p className="text-sm text-muted-foreground" id="guest-unlock-email-description">
          Email me when a guest unlocks one of my lockers.
        </p>
        {error ? (
          <p aria-live="polite" className="text-sm text-destructive" role="alert">{error}</p>
        ) : saved ? (
          <p aria-live="polite" className="text-sm text-muted-foreground" role="status">Preference saved.</p>
        ) : isPending ? (
          <p aria-live="polite" className="text-sm text-muted-foreground" role="status">Saving…</p>
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
