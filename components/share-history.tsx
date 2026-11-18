import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatEventTime } from "@/lib/events/presentation"
import type { ShareHistoryEvent } from "@/lib/shares/service"

const actionLabels = {
  CREATED: "Created",
  REVOKED: "Revoked",
  EXTENDED: "Extended",
} as const

export function ShareHistory({ events }: { events: ShareHistoryEvent[] }) {
  return (
    <section aria-labelledby="share-history-title" className="mt-8">
      <div className="mb-4">
        <h2 id="share-history-title" className="text-xl font-semibold">Share link history</h2>
        <p className="mt-1 text-sm text-muted-foreground">Created, revoked, and extended links for this locker.</p>
      </div>

      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          No share link history yet.
        </p>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableCaption className="sr-only">Share link history for this locker</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Time</TableHead>
                <TableHead scope="col">Guest</TableHead>
                <TableHead scope="col">Action</TableHead>
                <TableHead scope="col">Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    <time dateTime={event.createdAt.toISOString()}>
                      {formatEventTime(event.createdAt)}
                    </time>
                  </TableCell>
                  <TableCell>{event.grant.guestLabel || "Guest"}</TableCell>
                  <TableCell>
                    <Badge variant={event.action === "REVOKED" ? "destructive" : "secondary"}>
                      {actionLabels[event.action]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{event.detail ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
