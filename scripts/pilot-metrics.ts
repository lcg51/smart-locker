import { parseArgs } from "node:util"
import { getPilotMetrics } from "@/lib/metrics/queries"
import type { PilotMetrics } from "@/lib/metrics/queries"

const DAY_MS = 24 * 60 * 60 * 1000
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function dayStart(value: string): Date {
  if (!DATE_PATTERN.test(value)) throw new Error(`Invalid date "${value}"; use YYYY-MM-DD.`)
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid date "${value}".`)
  }
  return date
}

function dayEnd(value: string): Date {
  return new Date(dayStart(value).getTime() + DAY_MS - 1)
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

function formatReport(metrics: PilotMetrics, from: Date, to: Date): string {
  const rows: Array<[string, string]> = [
    ["Active residents", String(metrics.activeResidents)],
    ["Owner unlocks", String(metrics.ownerUnlocks)],
    ["Guest unlocks", String(metrics.guestUnlocks)],
    ["Failed unlocks", String(metrics.failedUnlocks)],
    ["Unlock success rate", formatRate(metrics.unlockSuccessRate)],
    ["Shares created", String(metrics.sharesCreated)],
    ["Shares redeemed", String(metrics.sharesRedeemed)],
    ["Share conversion", formatRate(metrics.shareConversionRate)],
    ["Revoked shares", String(metrics.revokedShares)],
    ["Expired shares", String(metrics.expiredShares)],
  ]

  return [
    "# Smart Locker pilot metrics",
    "",
    `Window: ${isoDay(from)} to ${isoDay(to)} (UTC, inclusive)`,
    "",
    "| Metric | Value |",
    "|---|---:|",
    ...rows.map(([label, value]) => `| ${label} | ${value} |`),
    "",
    "```json",
    JSON.stringify(metrics, null, 2),
    "```",
  ].join("\n")
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      from: { type: "string" },
      to: { type: "string" },
    },
    allowPositionals: false,
  })

  const today = new Date()
  const to = values.to ? dayEnd(values.to) : dayEnd(isoDay(today))
  const from = values.from
    ? dayStart(values.from)
    : new Date(dayStart(isoDay(to)).getTime() - 27 * DAY_MS)

  if (from > to) throw new Error("--from must be before or equal to --to.")

  const metrics = await getPilotMetrics({ from, to, now: new Date() })
  console.log(formatReport(metrics, from, to))
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
