# Task 27: Spanish localization

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Pilot hardening and growth design](../../specs/2026-11-03-smart-locker-pilot-hardening-design.md).
> Phase 3. **Depends on:** all UI tasks, especially Task 05, 06, 07, 08, 09, 10, 11, 14, 22, 24, and 25.

---

**Files:**
- Create: `lib/i18n/config.ts`, `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/es.ts`
- Create: `lib/i18n/server.ts`, `components/i18n-provider.tsx`, `components/language-settings.tsx`
- Create: `app/actions/locale.ts`
- Modify: `prisma/schema.prisma` (`User.locale`), migration
- Modify: `app/layout.tsx`, `app/dashboard/settings/page.tsx`, `app/auth/page.tsx`, all resident and guest pages/components
- Modify: `lib/email.ts`, `lib/shares/presentation.ts`, `lib/events/presentation.ts`
- Modify: `README.md`, `docs/pilot-setup-guide.md`
- Test: `tests/i18n/dictionaries.test.ts`, `e2e/localization.spec.ts`, `tests/email/guest-unlock.test.ts`

**Interfaces:**
- Consumes: `cookies()`, `headers()`, `getEnv()`, the existing UI copy.
- Produces:
  - `type Locale = "en" | "es"`; `defaultLocale = "en"`; `isLocale(value): value is Locale`
  - `getLocale(): Promise<Locale>` (cookie first, then `Accept-Language`, then English)
  - `getDictionary(locale: Locale): Dictionary`
  - `I18nProvider({ locale, dictionary, children })` and `useI18n()`
  - `setLocale(locale: Locale): Promise<void>` cookie action
  - `User.locale String @default("en")`
  - `formatShareExpiry(date: Date, locale?: Locale)`, `formatEventTime(date: Date, locale?: Locale)`

**Non-goals:** No URL locale prefixes, no third language, no machine translation at runtime, no automatic browser-language switch for signed-in residents, and no language control on guest pages.

- [ ] **Step 1: Write the failing dictionary test**

Create `tests/i18n/dictionaries.test.ts`:

```ts
it("has the same keys in English and Spanish", () => {
  expect(keysOf(es)).toEqual(keysOf(en))
})

it("does not leave an English string in a Spanish value that should be translated", () => {
  for (const key of keysOf(en)) {
    expect(getValue(es, key).trim()).not.toBe("")
  }
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/i18n/dictionaries.test.ts`
Expected: FAIL because the dictionaries do not exist.

- [ ] **Step 3: Add the locale layer**

Create `lib/i18n/config.ts`:

```ts
export const locales = ["en", "es"] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = "en"
export const localeCookie = "NEXT_LOCALE"
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value)
}
```

Create `lib/i18n/dictionaries/en.ts` with nested groups: `common`, `auth`, `onboarding`, `dashboard`, `locker`, `share`, `activity`, `settings`, `errors`, `email`. Include every user-facing string in the current app, including `aria-label`s, empty states, button labels, error messages, confirmations, and metadata. Export `type Dictionary = typeof en`.

Create `lib/i18n/dictionaries/es.ts` typed `satisfies Dictionary` with natural Spanish copy. Use `tú` for residents and neutral Spanish for guests. Keep the product name `Smart Locker` untranslated.

Create `lib/i18n/server.ts`:

```ts
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(localeCookie)?.value
  if (isLocale(cookie)) return cookie
  const header = (await headers()).get("accept-language")?.toLowerCase() ?? ""
  return header.startsWith("es") ? "es" : defaultLocale
}
export function getDictionary(locale: Locale): Dictionary {
  return locale === "es" ? es : en
}
```

Create `components/i18n-provider.tsx` as a client context that exposes `{ locale, dictionary }` and `useI18n()`. It must throw if used outside the provider.

- [ ] **Step 4: Add the cookie action and user preference**

Create `app/actions/locale.ts`:

```ts
"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

export async function setLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return
  const store = await cookies()
  store.set(localeCookie, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" })
  const session = await auth()
  if (session?.user?.id) {
    await prisma.user.update({ where: { id: session.user.id }, data: { locale } })
  }
  revalidatePath("/", "layout")
}
```

This does not require a session, so a guest page can still read the cookie; the user row is updated only when a resident is signed in.

Add `locale String @default("en")` to `User` and run:

```bash
pnpm exec prisma migrate dev --name user-locale
```

- [ ] **Step 5: Wire the root layout and Settings**

In `app/layout.tsx`:

- `const locale = await getLocale()`
- `const dictionary = getDictionary(locale)`
- Set `<html lang={locale}>`; keep the Geist variables, theme provider, and `suppressHydrationWarning`.
- Wrap the app in `<I18nProvider locale={locale} dictionary={dictionary}>`.
- Replace the static `metadata` export with `generateMetadata` that reads the dictionary for title and description.

In `app/dashboard/settings/page.tsx`, add a Language card with a `LanguageSettings` client component: two radio options, English and Español, calling `setLocale`. Keep the `min-h-11` touch target and the existing appearance card.

- [ ] **Step 6: Translate the resident UI**

Replace every hardcoded user-facing string in:

- `app/auth/page.tsx`, `app/auth/check-email/page.tsx`, `app/auth/error/page.tsx`
- `app/onboarding/page.tsx`, `components/locker-name-form.tsx`
- `app/dashboard/page.tsx`, `components/locker-card.tsx`, `components/header.tsx`
- `app/dashboard/lockers/[id]/page.tsx`, `components/locker-detail-controls.tsx`, `components/locker-activity.tsx`
- `app/dashboard/activity/page.tsx`
- `app/dashboard/settings/page.tsx`, `components/guest-unlock-email-toggle.tsx`, `components/pin-settings.tsx`, `components/delete-account-dialog.tsx`, `components/sign-out-button.tsx`
- `components/share-dialog.tsx`, `components/active-shares.tsx`, `components/share-qr.tsx`
- `components/app-lock.tsx`, `components/pin-pad.tsx`
- `app/privacy/page.tsx`

Server components read `getDictionary(await getLocale())`; client components use `useI18n()`. Pass strings into client components when a hook is not appropriate. Do not leave a raw English literal in a JSX text node or an `aria-label`.

- [ ] **Step 7: Translate the guest page and email**

- `app/share/[token]/page.tsx` uses `getLocale()` with the guest's `Accept-Language`; it has no language picker.
- `components/guest-unlock.tsx` uses the dictionary for every state, including errors and relock messages.
- `lib/shares/presentation.ts` and `lib/events/presentation.ts` accept a locale and format with `es-ES` or `en-GB`, still using `Europe/Madrid` for resident times and UTC for the explicit guest expiry.
- `lib/email.ts` accepts `locale` and uses the owner's `User.locale` when sending a guest-unlock email. Add a Spanish subject and body; keep the locker and guest label unescaped as plain text.

- [ ] **Step 8: Add the E2E test**

Create `e2e/localization.spec.ts`:

```ts
test("a resident and a guest can use the app in Spanish", async ({ browser }) => {
  const owner = await browser.newContext({ locale: "en-GB" })
  const page = await owner.newPage()
  await owner.request.post("/api/test/session", { data: { email: "ana@example.com" } })
  await page.goto("/dashboard/settings")
  await page.getByRole("radio", { name: "Español" }).click()
  await expect(page.getByRole("heading", { name: "Ajustes" })).toBeVisible()
  await page.goto("/dashboard")
  await expect(page.getByRole("heading", { name: "Tus taquillas" })).toBeVisible()

  const { token } = await createShareForSeed({ durationMinutes: 60 })
  const guest = await browser.newContext({ locale: "es-ES" })
  const guestPage = await guest.newPage()
  await guestPage.goto(`/share/${token}`)
  await expect(guestPage.getByText("Taquilla")).toBeVisible()
})
```

Use the `createShareForSeed` helper from Task 30 or an equivalent local setup. Keep the exact Spanish headings in the dictionary; if the copy changes, update both the dictionary and this test in the same commit.

Run: `pnpm test:e2e e2e/localization.spec.ts`
Expected: PASS.

- [ ] **Step 9: Update the docs**

- `README.md`: add Spanish to the feature list and explain that guests follow `Accept-Language` with no picker.
- `docs/pilot-setup-guide.md`: add a Spanish acceptance check for a resident and a guest, and note that the owner's email language follows their Settings choice.

- [ ] **Step 10: Run the full verification**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`
Expected: lint clean, typecheck clean, all tests pass, build passes, and every E2E test passes.

- [ ] **Step 11: Commit**

```bash
git add lib/i18n components/i18n-provider.tsx components/language-settings.tsx app/actions/locale.ts prisma app app/dashboard components lib/shares/presentation.ts lib/events/presentation.ts lib/email.ts tests/i18n tests/email e2e/localization.spec.ts README.md docs/pilot-setup-guide.md
git commit -m "feat: add Spanish localization"
```
