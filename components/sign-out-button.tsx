"use client"

import { useTransition, type ReactNode } from "react"
import { logout } from "@/app/actions/auth"
import { useI18n } from "@/components/i18n-provider"
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
  const { dictionary } = useI18n()
  const [isPending, startTransition] = useTransition()

  function handleSignOut() {
    clearPinState()
    startTransition(async () => {
      await logout()
    })
  }

  return (
    <Button
      aria-label={isPending ? dictionary.common.signingOut : ariaLabel}
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
