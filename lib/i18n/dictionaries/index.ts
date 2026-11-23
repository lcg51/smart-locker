import type { Locale } from "@/lib/i18n/config"
import { en, type Dictionary } from "./en"
import { es } from "./es"

export function getDictionary(locale: Locale): Dictionary {
  return locale === "es" ? es : en
}

// Only the groups client components read. Keeping the server-only groups
// (meta, activity, privacy, offline, email) out of the provider keeps guest
// pages small and avoids serializing vendor names a guest page never renders.
export type ClientDictionary = Pick<
  Dictionary,
  | "common"
  | "auth"
  | "onboarding"
  | "dashboard"
  | "locker"
  | "share"
  | "settings"
  | "appLock"
>

export function getClientDictionary(locale: Locale): ClientDictionary {
  const dictionary = getDictionary(locale)

  return {
    common: dictionary.common,
    auth: dictionary.auth,
    onboarding: dictionary.onboarding,
    dashboard: dictionary.dashboard,
    locker: dictionary.locker,
    share: dictionary.share,
    settings: dictionary.settings,
    appLock: dictionary.appLock,
  }
}

export type { Dictionary }
