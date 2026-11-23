import { isEmailAllowed } from "@/lib/auth/allowlist"
import { prisma } from "@/lib/db"
import type { Locale } from "@/lib/i18n/config"

type LocaleLookup = () => Promise<Locale>

/**
 * Decide a magic-link sign-in and keep `User.locale` aligned with the language
 * the resident actually sees. The locale sync is best-effort: a failed request
 * context or database write must never block an invited resident.
 */
export async function resolveSignIn(
  email: string | null | undefined,
  lookupLocale: LocaleLookup,
): Promise<true | string> {
  // Return a URL instead of `false`: Auth.js turns `false` into an
  // AccessDenied error, which can surface as a 500 page.
  if (!email) return "/auth?error=not_invited"

  try {
    if (!(await isEmailAllowed(email))) return "/auth?error=not_invited"
  } catch {
    return "/auth?error=unavailable"
  }

  try {
    const locale = await lookupLocale()
    await prisma.user.updateMany({ where: { email }, data: { locale } })
  } catch {
    // Locale sync is best-effort; sign-in still succeeds.
  }

  return true
}
