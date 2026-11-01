import type { Metadata } from "next"
import { Clock3, KeyRound, PackageCheck } from "lucide-react"
import { GuestUnlock } from "@/components/guest-unlock"
import { resolveShareToken } from "@/lib/shares/redeem"

export const metadata: Metadata = { referrer: "no-referrer" }

function formatExpiry(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZoneName: "short",
  }).format(date)
}

export default async function GuestSharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const result = await resolveShareToken(token)

  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-muted/40 px-4 py-10 sm:px-6">
      <section className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <KeyRound aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Smart Locker</p>
            <p className="text-xs text-muted-foreground">Guest access</p>
          </div>
        </div>

        {result.ok ? (
          <>
            <div className="mb-6">
              <p className="text-sm font-medium text-muted-foreground">You have access to</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">{result.grant.locker.name}</h1>
              {result.grant.guestLabel && (
                <p className="mt-2 text-sm text-muted-foreground">Shared with {result.grant.guestLabel}</p>
              )}
            </div>

            <div className="mb-6 flex items-start gap-3 rounded-lg bg-muted/70 p-4">
              <Clock3 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                This link is available until <time dateTime={result.grant.expiresAt.toISOString()}>{formatExpiry(result.grant.expiresAt)}</time>.
              </p>
            </div>

            <GuestUnlock token={token} />
            <p className="mt-6 text-center text-xs text-muted-foreground">No account or app needed. Keep this link private.</p>
          </>
        ) : (
          <div className="py-4 text-center">
            <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
              <PackageCheck aria-hidden="true" className="size-5 text-muted-foreground" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">This link is no longer available</h1>
            <p className="mt-2 text-sm text-muted-foreground">Ask the person who shared it with you for a new link.</p>
          </div>
        )}
      </section>
    </main>
  )
}
