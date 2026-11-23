import { Box } from "lucide-react"
import { LockerCard } from "@/components/locker-card"
import { getLockersForUser } from "@/lib/lockers/queries"
import { requireUser } from "@/lib/auth/session"
import { getDictionary, getLocale } from "@/lib/i18n/server"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const user = await requireUser()
  const lockers = await getLockersForUser(user.id)
  if (lockers.some((locker) => locker.confirmedAt === null)) redirect("/onboarding")
  const dictionary = getDictionary(await getLocale())

  return (
    <main className="container mx-auto px-4 py-8 sm:py-10">
      <div className="mb-8">
        <p className="text-sm font-medium text-muted-foreground">{dictionary.dashboard.eyebrow}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{dictionary.dashboard.title}</h1>
        <p className="mt-2 text-muted-foreground">{dictionary.dashboard.intro}</p>
      </div>

      {lockers.length === 0 ? (
        <section aria-labelledby="empty-lockers-title" className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
          <Box aria-hidden="true" className="mx-auto size-9 text-muted-foreground" />
          <h2 id="empty-lockers-title" className="mt-4 text-lg font-semibold">{dictionary.dashboard.emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {dictionary.dashboard.emptyBody}
          </p>
        </section>
      ) : (
        <section aria-label={dictionary.dashboard.listLabel} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lockers.map((locker) => <LockerCard key={locker.id} locker={locker} />)}
        </section>
      )}
    </main>
  )
}
