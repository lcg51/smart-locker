"use client"

import { useState, useTransition } from "react"
import { updateDisplayNameAction } from "@/app/actions/account"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"

export function ProfileNameForm({ currentName }: { currentName: string }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const updated = await updateDisplayNameAction(formData)
      if (updated) {
        toast({ title: "Display name updated." })
        return
      }

      setError("Enter a name between 1 and 40 characters.")
    })
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          autoComplete="name"
          className="min-h-11"
          defaultValue={currentName}
          id="displayName"
          maxLength={40}
          name="name"
          required
        />
        <p className="text-sm text-muted-foreground">Shown in your account details. 1–40 characters.</p>
      </div>
      <Button className="min-h-11" disabled={isPending} type="submit" variant="outline">
        {isPending ? "Saving…" : "Save name"}
      </Button>
      {error && (
        <p aria-live="polite" className="text-sm text-destructive-text" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
