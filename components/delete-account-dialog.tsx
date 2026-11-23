"use client"

import { useState, useTransition } from "react"
import { AlertTriangle } from "lucide-react"
import { deleteAccountAction } from "@/app/actions/account"
import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import { clearPinState } from "@/lib/pin"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function DeleteAccountDialog() {
  const { dictionary } = useI18n()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    setError(null)
    clearPinState()
    startTransition(async () => {
      try {
        await deleteAccountAction()
      } catch {
        setError(dictionary.settings.deleteFailed)
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button className="min-h-11" type="button" variant="destructive">
          {dictionary.settings.deleteAccount}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle aria-hidden="true" className="size-5 text-destructive-text" />
            {dictionary.settings.deleteTitle}
          </AlertDialogTitle>
          <AlertDialogDescription>{dictionary.settings.deleteDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p aria-live="polite" className="text-sm text-destructive-text" role="alert">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11" disabled={isPending}>{dictionary.settings.keepAccount}</AlertDialogCancel>
          <AlertDialogAction
            className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isPending}
            onClick={handleDelete}
          >
            {isPending ? dictionary.settings.deleting : dictionary.settings.deletePermanently}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
