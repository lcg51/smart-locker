"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { PinPad } from "@/components/pin-pad"
import { storage } from "@/lib/storage"
import { Lock } from "lucide-react"

export default function AuthPage() {
  const router = useRouter()
  const [error, setError] = useState(false)
  const [isShaking, setIsShaking] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const hasRedirected = useRef(false)

  useEffect(() => {
    if (hasRedirected.current) return

    console.log("[v0] Auth page - checking if already authenticated...")
    const isAuth = storage.isAuthenticated()
    console.log("[v0] Auth status:", isAuth)

    if (isAuth) {
      console.log("[v0] Already authenticated, redirecting to dashboard...")
      hasRedirected.current = true
      router.replace("/dashboard")
    } else {
      console.log("[v0] Not authenticated, showing PIN pad...")
      setIsCheckingAuth(false)
    }
  }, [router])

  const handlePinComplete = (enteredPin: string) => {
    if (hasRedirected.current) return

    console.log("[v0] PIN entered, validating...")
    const settings = storage.getSettings()

    if (enteredPin === settings.pin) {
      console.log("[v0] PIN correct, setting authenticated and redirecting...")
      storage.setAuthenticated(true)
      hasRedirected.current = true
      router.replace("/dashboard")
    } else {
      console.log("[v0] PIN incorrect")
      setError(true)
      setIsShaking(true)
      setTimeout(() => {
        setError(false)
        setIsShaking(false)
      }, 600)
    }
  }

  if (isCheckingAuth) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-4">
            <Lock className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2 text-balance">Smart Locker</h1>
          <p className="text-muted-foreground">Enter your PIN to access your lockers</p>
        </div>

        <div className={`bg-card rounded-2xl p-8 shadow-lg ${isShaking ? "animate-shake" : ""}`}>
          <PinPad onComplete={handlePinComplete} />
          {error && (
            <p className="text-destructive text-center mt-6 text-sm font-medium">Incorrect PIN. Please try again.</p>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">Default PIN: 1234</p>
      </div>
    </div>
  )
}
