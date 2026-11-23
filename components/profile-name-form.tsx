"use client"

import { useState, useTransition } from "react"
import { updateDisplayNameAction } from "@/app/actions/account"
import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"

export function ProfileNameForm({ currentName }: { currentName: string }) {
  const { dictionary } = useI18n()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const updated = await updateDisplayNameAction(formData)
      if (updated) {
        toast({ title: dictionary.settings.displayNameUpdated })
        return
      }

      setError(dictionary.settings.displayNameError)
    })
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="displayName">{dictionary.settings.displayName}</Label>
        <Input
          autoComplete="name"
          className="min-h-11"
          defaultValue={currentName}
          id="displayName"
          maxLength={40}
          name="name"
          required
        />
        <p className="text-sm text-muted-foreground">{dictionary.settings.displayNameHint}</p>
      </div>
      <Button className="min-h-11" disabled={isPending} type="submit" variant="outline">
        {isPending ? dictionary.common.saving : dictionary.common.saveName}
      </Button>
      {error && (
        <p aria-live="polite" className="text-sm text-destructive-text" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
