import type { Locale } from "@/lib/i18n/config"

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
