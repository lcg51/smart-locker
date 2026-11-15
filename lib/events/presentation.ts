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

const errorDetails: Record<string, string> = {
  provider_error: "The lock provider did not respond.",
  unknown_lock: "The locker is not registered with the provider.",
  not_found: "The locker is no longer available.",
  rate_limited: "Too many attempts. Try again shortly.",
  commands_disabled: "Unlocking is paused.",
  mock_failure: "The provider rejected the command.",
}

export function formatEventTime(date: Date, locale: "en" | "es" = "en"): string {
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

export function describeEvent(event: EventInput): EventDescription {
  const actor = event.actorType === "OWNER"
    ? "Resident"
    : event.actorType === "GUEST"
      ? event.grant?.guestLabel?.trim() || "Guest"
      : "System"

  return {
    actor,
    action: event.action === "UNLOCK" ? "Unlock" : "Lock",
    result: event.success ? "Succeeded" : "Failed",
    detail: event.success
      ? null
      : errorDetails[event.errorCode ?? ""] ?? "The locker did not respond.",
  }
}
