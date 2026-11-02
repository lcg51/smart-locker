"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { KeyRound, ShieldCheck } from "lucide-react"
import { PinPad } from "@/components/pin-pad"
import { SignOutButton } from "@/components/sign-out-button"
import { Button } from "@/components/ui/button"
import {
  parsePinCredential,
  PIN_STORAGE_KEY,
  PIN_UNLOCKED_STORAGE_KEY,
  readPinLockState,
  verifyPin,
  type PinCredential,
} from "@/lib/pin"

type LockState = "loading" | "open" | "locked" | "invalid" | "storage-unavailable"

export function AppLock({ children }: { children: ReactNode }) {
  const [lockState, setLockState] = useState<LockState>("loading")
  const [credential, setCredential] = useState<PinCredential | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const verificationInFlight = useRef(false)

  useEffect(() => {
    const state = readPinLockState(
      () => window.localStorage.getItem(PIN_STORAGE_KEY),
      () => window.sessionStorage.getItem(PIN_UNLOCKED_STORAGE_KEY),
    )
    setCredential(state.credential)
    setLockState(state.state)
  }, [])

  async function handlePinComplete(pin: string) {
    if (verificationInFlight.current) return
    if (!credential) {
      setLockState("invalid")
      return
    }

    verificationInFlight.current = true
    setIsVerifying(true)
    setError(null)
    try {
      const matches = await verifyPin(pin, credential.salt, credential.hash)
      if (!matches) {
        setError("Incorrect PIN. Try again.")
        return
      }

      try {
        window.sessionStorage.setItem(PIN_UNLOCKED_STORAGE_KEY, "1")
      } catch {
        // Keep this tab usable; the PIN will be requested again after refresh.
      }
      setLockState("open")
    } catch {
      setError("The PIN could not be checked. Sign out and sign in again to clear this device lock.")
    } finally {
      verificationInFlight.current = false
      setIsVerifying(false)
    }
  }

  if (lockState === "loading") {
    return (
      <main className="flex min-h-[100svh] items-center justify-center px-4" aria-busy="true">
        <p aria-live="polite" className="text-sm text-muted-foreground" role="status">Checking device lock…</p>
      </main>
    )
  }

  if (lockState === "open") return <>{children}</>

  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-muted/40 px-4 py-8 sm:px-6">
      <section aria-labelledby="app-lock-title" className="w-full max-w-sm rounded-2xl border bg-card p-6 text-center shadow-sm sm:p-8">
        <span aria-hidden="true" className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <KeyRound className="size-5" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight" id="app-lock-title">Unlock Smart Locker</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your 4-digit device PIN. This is a convenience lock for this browser, not account security.
        </p>

        {lockState === "invalid" ? (
          <p className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
            This device’s PIN data is unavailable. Sign out to clear the device lock.
          </p>
        ) : lockState === "storage-unavailable" ? (
          <div className="mt-6 space-y-3">
            <p className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
              This browser can’t access local storage, so the optional device PIN can’t be checked.
            </p>
            <Button className="min-h-11 w-full" onClick={() => setLockState("open")} type="button">
              Continue without device PIN
            </Button>
          </div>
        ) : (
          <div className="mt-6">
            <PinPad disabled={isVerifying} onComplete={handlePinComplete} />
            {isVerifying && <p aria-live="polite" className="mt-4 text-sm text-muted-foreground" role="status">Checking PIN…</p>}
            {error && <p aria-live="polite" className="mt-4 text-sm text-destructive" role="alert">{error}</p>}
          </div>
        )}

        <div className="mt-6 border-t pt-5">
          <p className="mb-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="size-4" />
            Your account remains protected by email sign-in.
          </p>
          <SignOutButton className="min-h-11 w-full" variant="outline">
            Sign out instead
          </SignOutButton>
        </div>
      </section>
    </main>
  )
}
