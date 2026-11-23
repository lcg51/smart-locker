"use client"

import { useEffect, useState, useTransition } from "react"
import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import { PinPad } from "@/components/pin-pad"
import { toast } from "@/hooks/use-toast"
import {
  clearPinState,
  generatePinSalt,
  hashPin,
  PIN_STORAGE_KEY,
  PIN_UNLOCKED_STORAGE_KEY,
  serializePinCredential,
} from "@/lib/pin"

type SetupStep = "idle" | "enter" | "confirm"

export function PinSettings() {
  const { dictionary } = useI18n()
  const [hasPin, setHasPin] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [step, setStep] = useState<SetupStep>("idle")
  const [firstPin, setFirstPin] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    try {
      /* eslint-disable react-hooks/set-state-in-effect -- device-local PIN state is read once after mount */
      setHasPin(window.localStorage.getItem(PIN_STORAGE_KEY) !== null)
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      setError(dictionary.settings.pinStorageUnavailable)
    } finally {
      setIsReady(true)
    }
  }, [dictionary.settings.pinStorageUnavailable])

  function beginSetup() {
    setStep("enter")
    setFirstPin(null)
    setError(null)
  }

  function cancelSetup() {
    setStep("idle")
    setFirstPin(null)
    setError(null)
  }

  function handlePinComplete(pin: string) {
    setError(null)
    if (step === "enter") {
      setFirstPin(pin)
      setStep("confirm")
      return
    }

    if (step !== "confirm" || !firstPin) return
    if (firstPin !== pin) {
      setFirstPin(null)
      setStep("enter")
      setError(dictionary.settings.pinMismatch)
      return
    }

    startTransition(async () => {
      try {
        const salt = generatePinSalt()
        const hash = await hashPin(pin, salt)
        window.localStorage.setItem(PIN_STORAGE_KEY, serializePinCredential(salt, hash))
        setHasPin(true)
        setStep("idle")
        setFirstPin(null)
        toast({ title: dictionary.settings.pinSetToast })
        try {
          window.sessionStorage.setItem(PIN_UNLOCKED_STORAGE_KEY, "1")
        } catch {
          toast({
            title: dictionary.settings.pinSavedToast,
            description: dictionary.settings.pinSavedDescription,
          })
        }
      } catch {
        setError(dictionary.settings.pinSaveFailed)
      }
    })
  }

  function removePin() {
    const cleared = clearPinState()
    if (!cleared.pinRemoved) {
      setError(dictionary.settings.pinRemoveFailed)
      return
    }
    setHasPin(false)
    setStep("idle")
    setFirstPin(null)
    setError(null)
    toast({ title: dictionary.settings.pinRemoved })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{dictionary.settings.pinIntro}</p>

      {isReady && step === "idle" ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button className="min-h-11" disabled={isPending} onClick={beginSetup} type="button" variant={hasPin ? "outline" : "default"}>
            {hasPin ? dictionary.settings.pinChange : dictionary.settings.pinSet}
          </Button>
          {hasPin && (
            <Button className="min-h-11" disabled={isPending} onClick={removePin} type="button" variant="ghost">
              {dictionary.settings.pinRemove}
            </Button>
          )}
        </div>
      ) : null}

      {!isReady && <p aria-live="polite" className="text-sm text-muted-foreground" role="status">{dictionary.settings.pinCheckingStorage}</p>}

      {step !== "idle" && (
        <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
          <p className="text-sm font-medium" aria-live="polite" role="status">
            {step === "enter" ? dictionary.settings.pinEnter : dictionary.settings.pinConfirm}
          </p>
          {isPending ? (
            <p aria-live="polite" className="text-sm text-muted-foreground" role="status">{dictionary.settings.pinSaving}</p>
          ) : (
            <PinPad onComplete={handlePinComplete} />
          )}
          <Button className="min-h-11" disabled={isPending} onClick={cancelSetup} type="button" variant="outline">
            {dictionary.common.cancel}
          </Button>
        </div>
      )}

      {error && <p aria-live="polite" className="text-sm text-destructive-text" role="alert">{error}</p>}
    </div>
  )
}
