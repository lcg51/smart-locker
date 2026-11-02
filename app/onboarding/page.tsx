import { redirect } from "next/navigation"
import { CheckCircle2, PackageCheck } from "lucide-react"
import { Header } from "@/components/header"
import { LockerNameForm } from "@/components/locker-name-form"
import { requireUser } from "@/lib/auth/session"
import { getLockersForUser } from "@/lib/lockers/queries"

export default async function OnboardingPage() {
  const user = await requireUser()
  const lockers = await getLockersForUser(user.id)

  if (lockers.every((locker) => locker.confirmedAt !== null)) redirect("/dashboard")

  const confirmedCount = lockers.filter((locker) => locker.confirmedAt !== null).length

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-8 sm:py-10">
        <header className="mb-8">
          <p className="text-sm font-medium text-muted-foreground">Apartment setup</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Confirm your lockers</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Check that these are the lockers assigned to your apartment, give each a name you recognize, and confirm access.
          </p>
        </header>

        <div
          aria-label="Locker setup progress"
          aria-valuemax={lockers.length}
          aria-valuemin={0}
          aria-valuenow={confirmedCount}
          className="mb-6 rounded-xl border bg-card p-4"
          role="progressbar"
        >
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="font-medium">Locker setup</span>
            <span className="text-muted-foreground">{confirmedCount} of {lockers.length} confirmed</span>
          </div>
          <div aria-hidden="true" className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${lockers.length ? (confirmedCount / lockers.length) * 100 : 100}%` }}
            />
          </div>
        </div>

        <ol aria-label="Lockers to confirm" className="space-y-4">
          {lockers.map((locker, index) => (
            <li className="rounded-xl border bg-card p-5 sm:p-6" key={locker.id}>
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <PackageCheck className="size-5 text-muted-foreground" />
                  </span>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Locker {index + 1}</p>
                    <h2 className="mt-1 text-lg font-semibold">{locker.name}</h2>
                  </div>
                </div>
                {locker.confirmedAt && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                    <CheckCircle2 aria-hidden="true" className="size-4" />
                    Confirmed
                  </span>
                )}
              </div>
              <LockerNameForm
                confirmed={locker.confirmedAt !== null}
                initialName={locker.name}
                lockerId={locker.id}
              />
            </li>
          ))}
        </ol>
      </main>
    </div>
  )
}
