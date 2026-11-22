"use client"

import { useActionState, useEffect, useRef } from "react"
import {
  initialRequestMagicLinkState,
  requestMagicLink,
} from "@/app/auth/actions"
import { toast } from "@/hooks/use-toast"

export function AuthForm({ notice }: { notice: string | null }) {
  const [state, formAction, isPending] = useActionState(requestMagicLink, initialRequestMagicLinkState)
  const shownNotice = useRef(false)
  const shownAt = useRef(0)

  useEffect(() => {
    if (!notice || shownNotice.current) return
    shownNotice.current = true
    toast({ title: notice, variant: "destructive" })
  }, [notice])

  useEffect(() => {
    if (!state.error || state.at === shownAt.current) return
    shownAt.current = state.at
    toast({ title: state.error, variant: "destructive" })
  }, [state])

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="email">
          Invited email address
        </label>
        <input
          autoComplete="email"
          className="flex min-h-12 w-full rounded-md border bg-background px-3 py-2 text-base outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          id="email"
          name="email"
          placeholder="you@example.com"
          required
          type="email"
        />
        <p className="text-sm text-muted-foreground">We’ll email you a secure sign-in link.</p>
      </div>
      <button
        aria-busy={isPending}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-primary px-4 font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Sending…" : "Send sign-in link"}
      </button>
    </form>
  )
}
