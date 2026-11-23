import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Battery, LockKeyhole, LockKeyholeOpen } from "lucide-react"
import { ActiveShares } from "@/components/active-shares"
import { LockerActivity } from "@/components/locker-activity"
import { LockerDetailControls } from "@/components/locker-detail-controls"
import { ShareDialog } from "@/components/share-dialog"
import { ShareHistory } from "@/components/share-history"
import { Button } from "@/components/ui/button"
import { requireUser } from "@/lib/auth/session"
import { listLockEvents } from "@/lib/events/queries"
import { fill } from "@/lib/i18n/format"
import { getDictionary, getLocale } from "@/lib/i18n/server"
import { getLockerForUser } from "@/lib/lockers/queries"
import { listActiveGrants, listShareHistory } from "@/lib/shares/service"

export default async function LockerDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireUser()
  const { id } = await params
  const locker = await getLockerForUser(user.id, id)
  if (!locker) notFound()

  const [grants, { events }, shareHistory, dictionary] = await Promise.all([
    listActiveGrants({ userId: user.id, lockerId: locker.id }),
    listLockEvents({ userId: user.id, lockerId: locker.id, limit: 10 }),
    listShareHistory({ userId: user.id, lockerId: locker.id }),
    getLocale().then(getDictionary),
  ])
  const status = locker.status === "LOCKED"
    ? dictionary.common.status.locked
    : locker.status === "UNLOCKED"
      ? dictionary.common.status.unlocked
      : dictionary.common.status.unknown
  const StatusIcon = locker.status === "LOCKED" ? LockKeyhole : LockKeyholeOpen

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <Button asChild className="mb-6 min-h-11 px-0" variant="ghost">
        <Link href="/dashboard">
          <ArrowLeft aria-hidden="true" className="size-4" />
          {dictionary.locker.back}
        </Link>
      </Button>

      <div className="flex flex-col gap-5 border-b pb-7 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{dictionary.dashboard.apartmentLocker}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{locker.name}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 font-medium text-foreground">
              <StatusIcon aria-hidden="true" className="size-4" />
              {status}
            </span>
            <span className="inline-flex items-center gap-2">
              <Battery aria-hidden="true" className="size-4" />
              {locker.batteryLevel === null
                ? dictionary.common.batteryUnavailable
                : fill(dictionary.common.batteryLevel, { level: locker.batteryLevel })}
            </span>
          </div>
        </div>
        <ShareDialog lockerId={locker.id} lockerName={locker.name} />
      </div>

      <LockerDetailControls locker={locker} />

      <section aria-labelledby="active-shares-title" className="mt-8">
        <div className="mb-4">
          <h2 id="active-shares-title" className="text-xl font-semibold">{dictionary.locker.activeSharesTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{dictionary.locker.activeSharesHint}</p>
        </div>
        <ActiveShares grants={grants} />
      </section>

      <ShareHistory events={shareHistory} />

      <LockerActivity events={events} lockerId={locker.id} />
    </main>
  )
}
