"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Check, Save } from "lucide-react"
import { confirmLockerAction, renameLockerAction } from "@/app/actions/lockers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { canConfirmLockerName, canEditLockerName } from "@/lib/lockers/onboarding"

export function LockerNameForm({
  lockerId,
  initialName,
  confirmed,
}: {
  lockerId: string
  initialName: string
  confirmed: boolean
}) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [savedName, setSavedName] = useState(initialName)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setSaveMessage(null)
    startTransition(async () => {
      const renamed = await renameLockerAction(lockerId, formData)
      if (!renamed) {
        setSaveMessage("Enter a name between 1 and 40 characters.")
        return
      }
      const saved = String(formData.get("name") ?? "").trim()
      setName(saved)
      setSavedName(saved)
      setSaveMessage("Name saved.")
      router.refresh()
    })
  }

  function handleConfirm() {
    setConfirmMessage(null)
    startTransition(async () => {
      const didConfirm = await confirmLockerAction(lockerId)
      if (!didConfirm) {
        setConfirmMessage("This locker couldn't be confirmed. Refresh the page and try again.")
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <form className="space-y-3" onSubmit={handleRename}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={`locker-name-${lockerId}`}>Locker name</label>
          <Input
            autoComplete="off"
            className="min-h-11"
            id={`locker-name-${lockerId}`}
            maxLength={40}
            name="name"
            disabled={!canEditLockerName(isPending)}
            onChange={(event) => setName(event.currentTarget.value)}
            required
            value={name}
          />
          <p className="text-sm text-muted-foreground">Choose a familiar name, such as “Kitchen”.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button className="min-h-11" disabled={isPending} type="submit" variant="outline">
            <Save aria-hidden="true" className="size-4" />
            {isPending ? "Saving…" : "Save name"}
          </Button>
          {saveMessage && <p aria-live="polite" className="text-sm text-muted-foreground" role="status">{saveMessage}</p>}
        </div>
      </form>

      {confirmed ? (
        <p className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          <Check aria-hidden="true" className="size-4" />
          Locker confirmed
        </p>
      ) : (
        <div className="space-y-2">
          <Button className="min-h-11 w-full sm:w-auto" disabled={isPending || !canConfirmLockerName(name, savedName)} onClick={handleConfirm} type="button">
            <Check aria-hidden="true" className="size-4" />
            {isPending ? "Confirming…" : "Confirm this locker"}
          </Button>
          {!canConfirmLockerName(name, savedName) && (
            <p className="text-sm text-muted-foreground">Save the locker name before confirming it.</p>
          )}
          {confirmMessage && <p aria-live="polite" className="text-sm text-destructive-text" role="alert">{confirmMessage}</p>}
        </div>
      )}
    </div>
  )
}
