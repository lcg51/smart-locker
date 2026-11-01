import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Battery, LockKeyhole, LockKeyholeOpen } from "lucide-react"
import { ActiveShares } from "@/components/active-shares"
import { ShareDialog } from "@/components/share-dialog"
import { Button } from "@/components/ui/button"
import { requireUser } from "@/lib/auth/session"
import { getLockerForUser } from "@/lib/lockers/queries"
import { listActiveGrants } from "@/lib/shares/service"

export default async function LockerDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireUser()
  const { id } = await params
  const locker = await getLockerForUser(user.id, id)
  if (!locker) notFound()

  const grants = await listActiveGrants({ userId: user.id, lockerId: locker.id })
  const status = locker.status === "LOCKED" ? "Locked" : locker.status === "UNLOCKED" ? "Unlocked" : "Status unknown"
  const StatusIcon = locker.status === "LOCKED" ? LockKeyhole : LockKeyholeOpen

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <Button asChild className="mb-6 min-h-11 px-0" variant="ghost">
        <Link href="/dashboard">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to lockers
        </Link>
      </Button>

      <div className="flex flex-col gap-5 border-b pb-7 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Apartment locker</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{locker.name}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 font-medium text-foreground">
              <StatusIcon aria-hidden="true" className="size-4" />
              {status}
            </span>
            <span className="inline-flex items-center gap-2">
              <Battery aria-hidden="true" className="size-4" />
              {locker.batteryLevel === null ? "Battery unavailable" : `${locker.batteryLevel}% battery`}
            </span>
          </div>
        </div>
        <ShareDialog lockerId={locker.id} lockerName={locker.name} />
      </div>

      <section aria-labelledby="active-shares-title" className="mt-8">
        <div className="mb-4">
          <h2 id="active-shares-title" className="text-xl font-semibold">Active share links</h2>
          <p className="mt-1 text-sm text-muted-foreground">Revoke a link at any time to remove guest access.</p>
        </div>
        <ActiveShares grants={grants} />
      </section>
    </main>
  )
}
