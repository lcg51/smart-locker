import type { Locale } from "@/lib/i18n/config"
import { en, type Dictionary } from "./en"
import { es } from "./es"

export function getDictionary(locale: Locale): Dictionary {
  return locale === "es" ? es : en
}

export type { Dictionary }
