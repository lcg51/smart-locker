"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Box, RefreshCw } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"

export function EmptyLockers() {
  const { dictionary } = useI18n()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <section aria-busy={isPending} aria-labelledby="empty-lockers-title" className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <Box aria-hidden="true" className="mx-auto size-9 text-muted-foreground" />
      <h2 id="empty-lockers-title" className="mt-4 text-lg font-semibold">
        {dictionary.dashboard.emptyTitle}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {dictionary.dashboard.emptyHint}
      </p>
      <p aria-live="polite" className="sr-only" role="status">
        {isPending ? dictionary.dashboard.emptyChecking : ""}
      </p>
      <Button
        className="mt-5 min-h-11"
        disabled={isPending}
        onClick={() => startTransition(() => router.refresh())}
        type="button"
        variant="outline"
      >
        <RefreshCw aria-hidden="true" className="size-4" />
        {isPending ? dictionary.dashboard.emptyChecking : dictionary.dashboard.emptyReload}
      </Button>
    </section>
  )
}
