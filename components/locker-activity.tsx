import Link from "next/link"
import type { LockEvent } from "@prisma/client"
import { ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { describeEvent, formatEventTime } from "@/lib/events/presentation"

type ActivityEvent = LockEvent & {
  grant: { guestLabel: string | null } | null
}

export function LockerActivity({ events, lockerId }: { events: ActivityEvent[]; lockerId: string }) {
  return (
    <section aria-labelledby="recent-activity-title" className="mt-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="recent-activity-title" className="text-xl font-semibold">Recent activity</h2>
          <p className="mt-1 text-sm text-muted-foreground">The latest access events for this locker.</p>
        </div>
        <Button asChild className="min-h-11 self-start px-0 sm:self-auto" variant="link">
          <Link href={`/dashboard/activity?lockerId=${lockerId}`}>
            View all activity
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">No activity for this locker yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableCaption className="sr-only">Recent access events for this locker</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Time</TableHead>
                <TableHead scope="col">Actor</TableHead>
                <TableHead scope="col">Action</TableHead>
                <TableHead scope="col">Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => {
                const description = describeEvent(event)
                return (
                  <TableRow key={event.id}>
                    <TableCell>
                      <time dateTime={event.createdAt.toISOString()}>
                        {formatEventTime(event.createdAt)}
                      </time>
                    </TableCell>
                    <TableCell>{description.actor}</TableCell>
                    <TableCell>{description.action}</TableCell>
                    <TableCell>
                      <Badge variant={event.success ? "secondary" : "destructive"}>
                        {description.result}
                      </Badge>
                      {description.detail && (
                        <p className="mt-1 text-xs text-muted-foreground">{description.detail}</p>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
