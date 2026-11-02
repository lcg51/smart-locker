"use client"

import { useEffect, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { PinPad } from "@/components/pin-pad"
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
  const [hasPin, setHasPin] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [step, setStep] = useState<SetupStep>("idle")
  const [firstPin, setFirstPin] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    try {
      setHasPin(window.localStorage.getItem(PIN_STORAGE_KEY) !== null)
    } catch {
      setError("Device storage is unavailable, so a PIN cannot be saved here.")
    } finally {
      setIsReady(true)
    }
  }, [])

  function beginSetup() {
    setStep("enter")
    setFirstPin(null)
    setError(null)
    setMessage("Enter a new 4-digit PIN.")
  }

  function cancelSetup() {
    setStep("idle")
    setFirstPin(null)
    setError(null)
    setMessage(null)
  }

  function handlePinComplete(pin: string) {
    setError(null)
    if (step === "enter") {
      setFirstPin(pin)
      setStep("confirm")
      setMessage("Enter the same PIN again to confirm it.")
      return
    }

    if (step !== "confirm" || !firstPin) return
    if (firstPin !== pin) {
      setFirstPin(null)
      setStep("enter")
      setError("Those PINs didn’t match. Start again.")
      setMessage("Enter a new 4-digit PIN.")
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
        setMessage("PIN set for this device.")
        try {
          window.sessionStorage.setItem(PIN_UNLOCKED_STORAGE_KEY, "1")
        } catch {
          setMessage("PIN saved. You’ll need to enter it again after refreshing this tab.")
        }
      } catch {
        setError("PIN couldn’t be saved. Check device storage and try again.")
      }
    })
  }

  function removePin() {
    clearPinState()
    setHasPin(false)
    setStep("idle")
    setFirstPin(null)
    setError(null)
    setMessage("Device PIN removed.")
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Optional convenience lock for this browser only. It is not account security; email sign-in still protects your account.
      </p>

      {isReady && step === "idle" ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button className="min-h-11" disabled={isPending} onClick={beginSetup} type="button" variant={hasPin ? "outline" : "default"}>
            {hasPin ? "Change device PIN" : "Set a device PIN"}
          </Button>
          {hasPin && (
            <Button className="min-h-11" disabled={isPending} onClick={removePin} type="button" variant="ghost">
              Remove PIN
            </Button>
          )}
        </div>
      ) : null}

      {!isReady && <p aria-live="polite" className="text-sm text-muted-foreground" role="status">Checking device storage…</p>}

      {step !== "idle" && (
        <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
          <p className="text-sm font-medium" aria-live="polite" role="status">
            {step === "enter" ? "Enter a new 4-digit PIN" : "Enter the same PIN again"}
          </p>
          {isPending ? (
            <p aria-live="polite" className="text-sm text-muted-foreground" role="status">Saving PIN…</p>
          ) : (
            <PinPad onComplete={handlePinComplete} />
          )}
          <Button className="min-h-11" disabled={isPending} onClick={cancelSetup} type="button" variant="outline">
            Cancel
          </Button>
        </div>
      )}

      {error && <p aria-live="polite" className="text-sm text-destructive" role="alert">{error}</p>}
      {message && step === "idle" && <p aria-live="polite" className="text-sm text-muted-foreground" role="status">{message}</p>}
    </div>
  )
}
