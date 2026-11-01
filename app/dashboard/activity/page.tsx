import Link from "next/link"
import { Activity, ArrowDown, ListFilter } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { requireUser } from "@/lib/auth/session"
import { getLockersForUser } from "@/lib/lockers/queries"
import { listLockEvents } from "@/lib/events/queries"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function buildActivityUrl(input: { cursor: string; lockerId?: string }): string {
  const params = new URLSearchParams({ cursor: input.cursor })
  if (input.lockerId) params.set("lockerId", input.lockerId)
  return `/dashboard/activity?${params.toString()}`
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await requireUser()
  const [params, userLockers] = await Promise.all([searchParams, getLockersForUser(user.id)])
  const requestedLockerId = typeof params.lockerId === "string" ? params.lockerId : undefined
  const lockerId = userLockers.find((locker) => locker.id === requestedLockerId)?.id
  const cursor = typeof params.cursor === "string" ? params.cursor : undefined
  const lockers = [...userLockers].sort((left, right) => left.name.localeCompare(right.name))
  const { events, nextCursor } = await listLockEvents({ userId: user.id, lockerId, cursor })

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <header className="mb-7">
        <p className="text-sm font-medium text-muted-foreground">Apartment access</p>
        <h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold tracking-tight">
          <Activity aria-hidden="true" className="size-7" />
          Activity
        </h1>
        <p className="mt-2 text-muted-foreground">A record of locker access in your apartment.</p>
      </header>

      <form action="/dashboard/activity" className="mb-5 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end" method="get">
        <div className="min-w-0 flex-1 space-y-2">
          <label className="text-sm font-medium" htmlFor="locker-filter">Locker</label>
          <select
            className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            defaultValue={lockerId ?? ""}
            id="locker-filter"
            name="lockerId"
          >
            <option value="">All lockers</option>
            {lockers.map((locker) => <option key={locker.id} value={locker.id}>{locker.name}</option>)}
          </select>
        </div>
        <Button className="min-h-11 sm:min-w-28" type="submit">
          <ListFilter aria-hidden="true" className="size-4" />
          Filter
        </Button>
      </form>

      {events.length === 0 ? (
        <section aria-labelledby="empty-activity-title" className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
          <Activity aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold" id="empty-activity-title">No activity yet.</h2>
          <p className="mt-2 text-sm text-muted-foreground">Locker access events will appear here.</p>
        </section>
      ) : (
        <>
          <div className="rounded-xl border bg-card">
            <Table>
              <TableCaption className="sr-only">Recent locker access events</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Time</TableHead>
                  <TableHead scope="col">Locker</TableHead>
                  <TableHead scope="col">Actor</TableHead>
                  <TableHead scope="col">Action</TableHead>
                  <TableHead scope="col">Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <time dateTime={event.createdAt.toISOString()}>{formatDate(event.createdAt)}</time>
                    </TableCell>
                    <TableCell className="font-medium">
                      {lockers.find((locker) => locker.id === event.lockerId)?.name ?? "Locker"}
                    </TableCell>
                    <TableCell>{event.actorType === "GUEST" ? "Guest" : event.actorType === "OWNER" ? "Resident" : "System"}</TableCell>
                    <TableCell>{event.action === "UNLOCK" ? "Unlock" : "Lock"}</TableCell>
                    <TableCell>
                      <Badge variant={event.success ? "secondary" : "destructive"}>
                        {event.success ? "Succeeded" : "Failed"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {nextCursor && (
            <div className="mt-5 flex justify-center">
              <Button asChild className="min-h-11" variant="outline">
                <Link href={buildActivityUrl({ cursor: nextCursor, lockerId })}>
                  <ArrowDown aria-hidden="true" className="size-4" />
                  Load more activity
                </Link>
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  )
}
