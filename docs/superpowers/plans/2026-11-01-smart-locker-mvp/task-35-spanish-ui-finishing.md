# Task 35: Spanish UI finishing pass

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Pilot hardening and growth design](../../specs/2026-11-03-smart-locker-pilot-hardening-design.md) §19.
> Phase 3. **Depends on:** Task 27.

---

**Files:**
- Create: `app/not-found.tsx`
- Modify: `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/es.ts`
- Modify: `components/ui/dialog.tsx`, `components/app-lock.tsx`, `components/extend-share-dialog.tsx`, `components/share-dialog.tsx`
- Modify: `lib/shares/presentation.ts`
- Modify: `e2e/security.spec.ts`, `e2e/localization.spec.ts`
- Test: `tests/shares/presentation.test.ts`, `tests/i18n/dictionaries.test.ts`

**Interfaces:**
- Consumes: `getLocale()`, `getDictionary()`, `useI18n()`, the existing root layout and `Link`.
- Produces:
  - `dictionary.notFound` with `title`, `body`, `back`.
  - `dictionary.share.thisGuestLower` for mid-sentence use.
  - A required `DialogContent.closeLabel` prop.
  - `formatShareExpiry(date, locale?)` with `en-GB` for English.

**Non-goals:** No `global-error.tsx` or framework 500 localization; those render
without the request locale and stay English, documented in the spec. No visual
redesign, no new routes, no third language.

- [ ] **Step 1: Write the failing Spanish 404 test**

Add to `e2e/localization.spec.ts`:

```ts
test("a Spanish browser gets a Spanish not-found page", async ({ browser }) => {
  const context = await browser.newContext({ locale: "es-ES" })
  const page = await context.newPage()
  const response = await page.goto("/this-page-does-not-exist")

  expect(response?.status()).toBe(404)
  await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Volver a Smart Locker" })).toBeVisible()
  await expect(page.locator("html")).toHaveAttribute("lang", "es")

  await context.close()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:e2e e2e/localization.spec.ts -g "not-found"`

Expected: FAIL. The page renders Next's English "This page could not be found"
and has no Spanish heading.

- [ ] **Step 3: Add the dictionary and the page**

Add to both dictionaries under a new `notFound` group:

```ts
notFound: {
  title: "Page not found",
  body: "The page you are looking for doesn’t exist or has moved.",
  back: "Back to Smart Locker",
},
```

Spanish:

```ts
notFound: {
  title: "Página no encontrada",
  body: "La página que buscas no existe o se ha movido.",
  back: "Volver a Smart Locker",
},
```

Create `app/not-found.tsx` as a Server Component:

```tsx
import Link from "next/link"
import { getDictionary, getLocale } from "@/lib/i18n/server"

export default async function NotFound() {
  const dictionary = getDictionary(await getLocale())

  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-muted/40 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">{dictionary.common.appName}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{dictionary.notFound.title}</h1>
        <p className="mt-3 text-muted-foreground">{dictionary.notFound.body}</p>
        <Link
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          href="/"
        >
          {dictionary.notFound.back}
        </Link>
      </section>
    </main>
  )
}
```

The root layout already provides `<html lang>` and `I18nProvider`, so the page
inherits the active locale.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:e2e e2e/localization.spec.ts -g "not-found"`

Expected: PASS.

- [ ] **Step 5: Update the existing 404 assertion**

`e2e/security.spec.ts` still expects Next's default "This page could not be
found" for a cross-resident locker URL. Replace that assertion with the new
English heading `Page not found` and keep the 404 status check. Search the repo
for the old string and update every assertion:

```bash
grep -rn "This page could not be found" e2e
```

Run: `pnpm test:e2e e2e/security.spec.ts`

Expected: PASS.

- [ ] **Step 6: Finish the residual copy and label fixes**

Make these changes; each is a string or one-line component edit:

- `es.auth.emailLabel`: "Dirección de correo invitada".
- `es.settings.guestEmailsTitle`: "Avisos de desbloqueo de invitados".
- `es.email.guestBody`: "{guest} desbloqueó {locker} el {time}." (the `time` value is a full date).
- `es.common.apartmentAccess`, `es.dashboard.eyebrow`, and `es.activity.eyebrow`: "Acceso a la vivienda".
- `es.dashboard.apartmentLocker`: "Taquilla de la vivienda".
- `es.common.retryStatus`: "Reintentar comprobación".
- Add `share.thisGuestLower`: English "this guest", Spanish "este invitado". Use it in `extendBody`; keep `thisGuest` for the sentence-initial revoke copy.
- In `components/app-lock.tsx`, render `dictionary.appLock.signOutInstead` as the visible button label (not `common.signOut`), so English keeps "Sign out instead".
- In `components/ui/dialog.tsx`, make `closeLabel` required instead of defaulting to English. Both call sites must pass it: `components/share-dialog.tsx` (even though it hides the default close button with `showCloseButton={false}`) and `components/extend-share-dialog.tsx` (already passes `dictionary.common.close`).

- [ ] **Step 7: Standardize the English share-expiry format**

Change `tests/shares/presentation.test.ts` first:

```ts
expect(formatShareExpiry(new Date("2026-11-02T15:30:00.000Z"))).toBe("2 Nov 2026, 15:30 UTC")
```

Run: `pnpm test tests/shares/presentation.test.ts`

Expected: FAIL with the old `Nov 2, 2026, 3:30 PM UTC` value.

Change `lib/shares/presentation.ts` to use `"en-GB"` instead of `"en"` for the
English branch.

Run: `pnpm test tests/shares/presentation.test.ts`

Expected: PASS. If the exact output differs, keep `en-GB` and update the expected
string to the actual `Intl` output; do not change the timezone.

- [ ] **Step 8: Run the full verification**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`

Expected: lint clean, typecheck clean, all unit tests pass, build passes, and
every E2E test passes.

- [ ] **Step 9: Commit**

```bash
git add app/not-found.tsx components lib e2e tests docs
git commit -m "feat: finish the Spanish UI and localize not-found"
```

---

## Review focus

- The 404 must be neutral and link to `/` so a signed-in resident lands on the
  dashboard and a guest lands on sign-in.
- No English string may reappear in the Spanish copy changes; the dictionary
  parity and placeholder tests must stay green.
- Removing the `DialogContent` default is deliberate: a future dialog with a
  close button must pass a localized label rather than silently shipping
  English.
