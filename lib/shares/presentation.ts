import type { Dictionary } from "@/lib/i18n/dictionaries"
import type { Locale } from "@/lib/i18n/config"
import { fill } from "@/lib/i18n/format"

export function formatShareExpiry(date: Date, locale: Locale = "en"): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date)
}

/**
 * Share events store their detail as an English string. Translate the shapes
 * this app writes at render time, and leave any older or unknown note as-is.
 */
export function formatShareDetail(detail: string, dictionary: Dictionary): string {
  if (detail === "No change") return dictionary.share.detailNoChange

  const addedBoth = /^\+(\d+) minutes, \+(\d+) uses$/.exec(detail)
  if (addedBoth) {
    return fill(dictionary.share.detailAddedBoth, {
      minutes: Number(addedBoth[1]),
      uses: Number(addedBoth[2]),
    })
  }

  const created = /^(\d+) minutes, (\d+) uses$/.exec(detail)
  if (created) {
    return fill(dictionary.share.detailCreated, {
      minutes: Number(created[1]),
      uses: Number(created[2]),
    })
  }

  const addedMinutes = /^\+(\d+) minutes$/.exec(detail)
  if (addedMinutes) {
    return fill(dictionary.share.detailAddedMinutes, { minutes: Number(addedMinutes[1]) })
  }

  const addedUses = /^\+(\d+) uses$/.exec(detail)
  if (addedUses) {
    return fill(dictionary.share.detailAddedUses, { uses: Number(addedUses[1]) })
  }

  return detail
}
