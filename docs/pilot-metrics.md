# Pilot Metrics

`pnpm metrics` prints a read-only Markdown table and JSON block from the application
database. It does not add client analytics, does not write to the database, and does not
track `/share/*` pages. It contains aggregate counts only, with no guest PII.

## Run it

```bash
pnpm metrics --from 2026-10-01 --to 2026-11-01
```

- Dates are `YYYY-MM-DD` in UTC and the window is inclusive.
- Either date can be omitted; the default is the last 28 calendar days.
- The command exits non-zero for an invalid date, `from` after `to`, or a database error.
- Point `DATABASE_URL` at the intended database first. The script loads `.env.local` and then `.env`, with `.env.local` taking precedence.

## Definitions

| Metric | Definition |
|---|---|
| `activeResidents` | Distinct residents with at least one successful `OWNER` or `GUEST` lock event in the window. System events do not count. |
| `ownerUnlocks` | Successful `UNLOCK` events by `OWNER`. |
| `guestUnlocks` | Successful `UNLOCK` events by `GUEST`. |
| `failedUnlocks` | Failed `UNLOCK` events, regardless of actor. Relock (`LOCK`) failures are not unlocks and are excluded. |
| `unlockSuccessRate` | Successful `UNLOCK` events divided by all `UNLOCK` events in the window. `0` when there are no attempts. |
| `sharesCreated` | `ShareGrant` rows whose `createdAt` is in the window. |
| `sharesRedeemed` | Distinct `grantId` values from successful `GUEST` `UNLOCK` events in the window. Repeated unlocks on one link count once. A link created before the window can still appear here. |
| `shareConversionRate` | `sharesRedeemed / sharesCreated`; `0` when no shares were created. Because redemption counts links from any creation date, it can exceed 100% in a window that redeems older links. |
| `revokedShares` | Grants created in the window whose `revokedAt` is set. |
| `expiredShares` | Grants created in the window, still unrevoked, whose `expiresAt` is before the report's `now`. |

The exact implementation is `getPilotMetrics` in `lib/metrics/queries.ts`: one
`LockEvent` query and one `ShareGrant` query, both filtered to the window.

## Reading zero denominators

A rate of `0` means “no attempts” or “no shares created,” not necessarily a failure.
Check the corresponding count first:

- No unlock attempts: `unlockSuccessRate` is `0`.
- No shares created: `shareConversionRate` is `0`.

## MVP success signals

The pilot design tracks:

- A resident unlocks at least once per week.
- Each active resident creates at least one share link per month.
- At least 95% of unlock attempts succeed, excluding known offline lockers.
- No share-token incident.

The report supports those signals from server data. It is not a substitute for the
incident log or the privacy and security review.
