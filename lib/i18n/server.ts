import { cookies, headers } from "next/headers"
import { defaultLocale, isLocale, localeCookie, type Locale } from "@/lib/i18n/config"

export { getDictionary } from "@/lib/i18n/dictionaries"

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(localeCookie)?.value
  if (isLocale(cookie)) return cookie

  const header = (await headers()).get("accept-language")?.toLowerCase() ?? ""
  return header.startsWith("es") ? "es" : defaultLocale
}
