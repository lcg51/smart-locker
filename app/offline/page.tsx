import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "You are offline" }

export default function OfflinePage() {
  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-muted/40 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">Smart Locker</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">You are offline</h1>
        <p className="mt-3 text-muted-foreground">
          Unlocking a locker needs a connection. Reconnect to the internet and try again.
        </p>
        <Link
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          href="/dashboard"
        >
          Try the dashboard
        </Link>
      </section>
    </main>
  )
}
