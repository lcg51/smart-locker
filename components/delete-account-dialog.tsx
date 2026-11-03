"use client"

import { useState, useTransition } from "react"
import { AlertTriangle } from "lucide-react"
import { deleteAccountAction } from "@/app/actions/account"
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
        setError("We couldn't delete your account. Your data is unchanged; please try again.")
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button className="min-h-11" type="button" variant="destructive">
          Delete account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle aria-hidden="true" className="size-5 text-destructive-text" />
            Delete your account permanently?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes your account, lockers, active share links, access history, and sign-in sessions. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p aria-live="polite" className="text-sm text-destructive-text" role="alert">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11" disabled={isPending}>Keep my account</AlertDialogCancel>
          <AlertDialogAction
            className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isPending}
            onClick={handleDelete}
          >
            {isPending ? "Deleting…" : "Delete account permanently"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
