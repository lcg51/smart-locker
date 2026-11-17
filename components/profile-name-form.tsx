"use client"

import { useState, useTransition } from "react"
import { updateDisplayNameAction } from "@/app/actions/account"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ProfileNameForm({ currentName }: { currentName: string }) {
  const [message, setMessage] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setMessage(null)
    setFailed(false)
    startTransition(async () => {
      const updated = await updateDisplayNameAction(formData)
      if (updated) {
        setMessage("Display name updated.")
        return
      }

      setFailed(true)
      setMessage("Enter a name between 1 and 40 characters.")
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
      {message && (
        <p
          aria-live="polite"
          className={failed ? "text-sm text-destructive-text" : "text-sm text-muted-foreground"}
          role={failed ? "alert" : "status"}
        >
          {message}
        </p>
      )}
    </form>
  )
}
