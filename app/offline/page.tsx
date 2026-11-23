import type { Metadata } from "next"
import Link from "next/link"
import { getDictionary, getLocale } from "@/lib/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).offline.metaTitle }
}

export default async function OfflinePage() {
  const dictionary = getDictionary(await getLocale())

  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-muted/40 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">{dictionary.common.appName}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{dictionary.offline.title}</h1>
        <p className="mt-3 text-muted-foreground">{dictionary.offline.body}</p>
        <Link
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          href="/dashboard"
        >
          {dictionary.offline.action}
        </Link>
      </section>
    </main>
  )
}
