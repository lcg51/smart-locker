"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Check, Save } from "lucide-react"
import { confirmLockerAction, renameLockerAction } from "@/app/actions/lockers"
import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { canConfirmLockerName, canEditLockerName } from "@/lib/lockers/onboarding"
import { toast } from "@/hooks/use-toast"

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
  const { dictionary } = useI18n()
  const [name, setName] = useState(initialName)
  const [savedName, setSavedName] = useState(initialName)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setSaveError(null)
    startTransition(async () => {
      const renamed = await renameLockerAction(lockerId, formData)
      if (!renamed) {
        setSaveError(dictionary.onboarding.nameError)
        return
      }
      const saved = String(formData.get("name") ?? "").trim()
      setName(saved)
      setSavedName(saved)
      toast({ title: dictionary.onboarding.nameSaved })
      router.refresh()
    })
  }

  function handleConfirm() {
    setConfirmMessage(null)
    startTransition(async () => {
      const didConfirm = await confirmLockerAction(lockerId)
      if (!didConfirm) {
        setConfirmMessage(dictionary.onboarding.confirmError)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <form className="space-y-3" onSubmit={handleRename}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={`locker-name-${lockerId}`}>
            {dictionary.onboarding.nameLabel}
          </label>
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
          <p className="text-sm text-muted-foreground">{dictionary.onboarding.nameHint}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button className="min-h-11" disabled={isPending} type="submit" variant="outline">
            <Save aria-hidden="true" className="size-4" />
            {isPending ? dictionary.common.saving : dictionary.common.saveName}
          </Button>
          {saveError && <p aria-live="polite" className="text-sm text-destructive-text" role="alert">{saveError}</p>}
        </div>
      </form>

      {confirmed ? (
        <p className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          <Check aria-hidden="true" className="size-4" />
          {dictionary.onboarding.confirmedBadge}
        </p>
      ) : (
        <div className="space-y-2">
          <Button className="min-h-11 w-full sm:w-auto" disabled={isPending || !canConfirmLockerName(name, savedName)} onClick={handleConfirm} type="button">
            <Check aria-hidden="true" className="size-4" />
            {isPending ? dictionary.onboarding.confirming : dictionary.onboarding.confirm}
          </Button>
          {!canConfirmLockerName(name, savedName) && (
            <p className="text-sm text-muted-foreground">{dictionary.onboarding.saveFirst}</p>
          )}
          {confirmMessage && <p aria-live="polite" className="text-sm text-destructive-text" role="alert">{confirmMessage}</p>}
        </div>
      )}
    </div>
  )
}
