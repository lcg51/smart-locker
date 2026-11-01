import { Box } from "lucide-react"
import { LockerCard } from "@/components/locker-card"
import { getLockersForUser } from "@/lib/lockers/queries"
import { requireUser } from "@/lib/auth/session"

export default async function DashboardPage() {
  const user = await requireUser()
  const lockers = await getLockersForUser(user.id)

  return (
    <main className="container mx-auto px-4 py-8 sm:py-10">
      <div className="mb-8">
        <p className="text-sm font-medium text-muted-foreground">Apartment access</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Your lockers</h1>
        <p className="mt-2 text-muted-foreground">Check status and control the lockers in your apartment.</p>
      </div>

      {lockers.length === 0 ? (
        <section aria-labelledby="empty-lockers-title" className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
          <Box aria-hidden="true" className="mx-auto size-9 text-muted-foreground" />
          <h2 id="empty-lockers-title" className="mt-4 text-lg font-semibold">No lockers yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Your apartment lockers will appear here once your building administrator has set up your account.
          </p>
        </section>
      ) : (
        <section aria-label="Your lockers" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lockers.map((locker) => <LockerCard key={locker.id} locker={locker} />)}
        </section>
      )}
    </main>
  )
}
