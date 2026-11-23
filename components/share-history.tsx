import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatEventTime } from "@/lib/events/presentation"
import { getDictionary, getLocale } from "@/lib/i18n/server"
import { formatShareDetail } from "@/lib/shares/presentation"
import type { ShareHistoryEvent } from "@/lib/shares/service"

export async function ShareHistory({ events }: { events: ShareHistoryEvent[] }) {
  const locale = await getLocale()
  const dictionary = getDictionary(locale)
  const actionLabels = {
    CREATED: dictionary.share.created,
    REVOKED: dictionary.share.revoked,
    EXTENDED: dictionary.share.extendedAction,
  } as const

  return (
    <section aria-labelledby="share-history-title" className="mt-8">
      <div className="mb-4">
        <h2 id="share-history-title" className="text-xl font-semibold">{dictionary.share.historyTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{dictionary.share.historyIntro}</p>
      </div>

      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          {dictionary.share.historyEmpty}
        </p>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableCaption className="sr-only">{dictionary.share.historyCaption}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{dictionary.activity.time}</TableHead>
                <TableHead scope="col">{dictionary.common.guest}</TableHead>
                <TableHead scope="col">{dictionary.activity.action}</TableHead>
                <TableHead scope="col">{dictionary.share.detail}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    <time dateTime={event.createdAt.toISOString()}>
                      {formatEventTime(event.createdAt, locale)}
                    </time>
                  </TableCell>
                  <TableCell>{event.grant.guestLabel || dictionary.common.guest}</TableCell>
                  <TableCell>
                    <Badge variant={event.action === "REVOKED" ? "destructive" : "secondary"}>
                      {actionLabels[event.action]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {event.detail ? formatShareDetail(event.detail, dictionary) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
