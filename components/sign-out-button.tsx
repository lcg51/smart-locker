"use client"

import { useTransition, type ReactNode } from "react"
import { logout } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { clearPinState } from "@/lib/pin"

type SignOutButtonProps = {
  children: ReactNode
  ariaLabel?: string
  className?: string
  size?: "default" | "icon" | "lg"
  variant?: "default" | "outline" | "ghost"
}

export function SignOutButton({
  children,
  ariaLabel,
  className,
  size = "default",
  variant = "ghost",
}: SignOutButtonProps) {
  const [isPending, startTransition] = useTransition()

  function handleSignOut() {
    clearPinState()
    startTransition(async () => {
      await logout()
    })
  }

  return (
    <Button
      aria-label={isPending ? "Signing out" : ariaLabel}
      className={className}
      disabled={isPending}
      onClick={handleSignOut}
      size={size}
      type="button"
      variant={variant}
    >
      {children}
    </Button>
  )
}
