import type { Locale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"

type EventInput = {
  actorType: "OWNER" | "GUEST" | "SYSTEM"
  grant: { guestLabel: string | null } | null
  action: "UNLOCK" | "LOCK"
  success: boolean
  errorCode: string | null
}

type EventDescription = {
  actor: string
  action: string
  result: string
  detail: string | null
}

export function formatEventTime(date: Date, locale: Locale = "en"): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Madrid",
    timeZoneName: "short",
  }).format(date)
}

function describeError(errorCode: string, locale: Locale): string {
  const dictionary = getDictionary(locale)

  switch (errorCode) {
    case "provider_error":
      return dictionary.activity.errorProvider
    case "unknown_lock":
      return dictionary.activity.errorUnknownLock
    case "not_found":
      return dictionary.activity.errorNotFound
    case "rate_limited":
      return dictionary.activity.errorRateLimited
    case "commands_disabled":
      return dictionary.activity.errorCommandsDisabled
    case "mock_failure":
      return dictionary.activity.errorMockFailure
    default:
      return dictionary.activity.errorFallback
  }
}

export function describeEvent(event: EventInput, locale: Locale = "en"): EventDescription {
  const dictionary = getDictionary(locale)
  const actor = event.actorType === "OWNER"
    ? dictionary.activity.actorResident
    : event.actorType === "GUEST"
      ? event.grant?.guestLabel?.trim() || dictionary.common.guest
      : dictionary.activity.actorSystem

  return {
    actor,
    action: event.action === "UNLOCK"
      ? dictionary.activity.actionUnlock
      : dictionary.activity.actionLock,
    result: event.success ? dictionary.activity.succeeded : dictionary.activity.failed,
    detail: event.success ? null : describeError(event.errorCode ?? "", locale),
  }
}
