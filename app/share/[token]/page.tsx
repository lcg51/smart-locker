import type { Metadata } from "next"
import { Clock3, KeyRound, PackageCheck } from "lucide-react"
import { GuestUnlock } from "@/components/guest-unlock"
import { fill } from "@/lib/i18n/format"
import { getDictionary, getLocale } from "@/lib/i18n/server"
import { formatShareExpiry } from "@/lib/shares/presentation"
import { resolveRelockState, resolveShareToken } from "@/lib/shares/redeem"

export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false, nocache: true },
}

export default async function GuestSharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const locale = await getLocale()
  const dictionary = getDictionary(locale)
  const [result, relock] = await Promise.all([
    resolveShareToken(token),
    resolveRelockState(token),
  ])
  const pendingRelockAt = relock.relockAt?.toISOString() ?? null

  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-muted/40 px-4 py-10 sm:px-6">
      <section className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <KeyRound aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">{dictionary.common.appName}</p>
            <p className="text-xs text-muted-foreground">{dictionary.share.guestAccess}</p>
          </div>
        </div>

        {result.ok ? (
          <>
            <div className="mb-6">
              <p className="text-sm font-medium text-muted-foreground">{dictionary.share.youHaveAccess}</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">{result.grant.locker.name}</h1>
              {result.grant.guestLabel && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {fill(dictionary.share.sharedWith, { guest: result.grant.guestLabel })}
                </p>
              )}
            </div>

            <div className="mb-6 flex items-start gap-3 rounded-lg bg-muted/70 p-4">
              <Clock3 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-sm text-foreground">
                {dictionary.share.availableUntilBefore}
                <time dateTime={result.grant.expiresAt.toISOString()}>
                  {formatShareExpiry(result.grant.expiresAt, locale)}
                </time>
                {dictionary.share.availableUntilAfter}
              </p>
            </div>

            <GuestUnlock
              token={token}
              initialRelockAt={pendingRelockAt}
            />
            <p className="mt-6 text-center text-xs text-muted-foreground">{dictionary.share.noAppNeeded}</p>
          </>
        ) : (
          <div className="py-4 text-center">
            <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
              <PackageCheck aria-hidden="true" className="size-5 text-muted-foreground" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">{dictionary.share.unavailableTitle}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{dictionary.share.unavailableBody}</p>
            {pendingRelockAt && (
              <div className="mt-6 text-left">
                <GuestUnlock token={token} initialRelockAt={pendingRelockAt} relockOnly />
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
