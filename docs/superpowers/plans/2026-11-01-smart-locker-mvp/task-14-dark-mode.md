# Task 14: Light, dark, and system appearance

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Smart Locker MVP — Design](../../specs/2026-11-01-smart-locker-mvp-design.md).
> Phase 1.5. **Depends on:** Task 13.

---

**Files:**
- Create: `components/theme-provider.tsx`, `components/appearance-settings.tsx`
- Modify: `app/layout.tsx`, `app/dashboard/settings/page.tsx`
- Create: `e2e/theme.spec.ts`
- Modify: `README.md`, `docs/pilot-setup-guide.md`

**Interfaces:**
- Consumes: `next-themes` (already in `package.json`; import `ThemeProvider as NextThemesProvider` and `useTheme`), the `.dark` tokens and `@custom-variant dark` already in `app/globals.css`, `components/ui/radio-group.tsx`, `components/ui/label.tsx`.
- Produces: `ThemeProvider({ children }: { children: React.ReactNode })`, `AppearanceSettings()`, an `html` element that carries `class="dark"` plus `color-scheme` when dark, and a persisted `theme` value in `localStorage` (`light`, `dark`, or `system`).

**Non-goals:** No accent-color picker, no per-account theme sync, and no theme control on guest pages.

- [ ] **Step 1: Write the failing appearance test**

Create `e2e/theme.spec.ts`:

```ts
import { expect, test } from "@playwright/test"

test("appearance follows the settings choice and the device preference", async ({ browser }) => {
  const owner = await browser.newContext()
  const page = await owner.newPage()

  try {
    const sessionResponse = await owner.request.post("/api/test/session", {
      data: { email: "ana@example.com" },
    })
    expect(sessionResponse.status()).toBe(200)

    await page.goto("/dashboard/settings")
    await expect(page.getByText("Appearance", { exact: true })).toBeVisible()

    await page.getByRole("radio", { name: "Dark" }).click()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await expect(page.locator("html")).toHaveCSS("color-scheme", "dark")

    await page.reload()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked()

    await page.getByRole("radio", { name: "Light" }).click()
    await expect(page.locator("html")).not.toHaveClass(/dark/)

    await page.getByRole("radio", { name: "System" }).click()
    await expect(page.locator("html")).not.toHaveClass(/dark/)
  } finally {
    await owner.close()
  }

  const darkContext = await browser.newContext({ colorScheme: "dark" })
  const darkPage = await darkContext.newPage()

  try {
    await darkPage.goto("/auth")
    await expect(darkPage.locator("html")).toHaveClass(/dark/)
    await expect(darkPage.locator("html")).toHaveCSS("color-scheme", "dark")

    await darkPage.goto("/share/not-a-real-token")
    await expect(darkPage.getByText("no longer available")).toBeVisible()
    await expect(darkPage.locator("html")).toHaveClass(/dark/)
  } finally {
    await darkContext.close()
  }
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:e2e e2e/theme.spec.ts`

Expected: FAIL because `/dashboard/settings` has no "Appearance" text and no theme provider applies `class="dark"`.

- [ ] **Step 3: Mount the theme provider in the root layout**

Create `components/theme-provider.tsx` as a client component that wraps `NextThemesProvider` with `attribute="class"`, `defaultTheme="system"`, `enableSystem`, and `disableTransitionOnChange`. Keep `enableColorScheme` at its default so `html` gets `color-scheme`.

Modify `app/layout.tsx`:

- Add `suppressHydrationWarning` to `<html lang="en">`; next-themes writes the class before hydration.
- Wrap `{children}`, `<Toaster />`, and `<SafeAnalytics />` in `<ThemeProvider>` inside `<body>`.

Do not add a `<script>` or inline theme code; next-themes injects its own pre-hydration script.

- [ ] **Step 4: Add the Appearance card to settings**

Create `components/appearance-settings.tsx` as a client component:

- Call `useTheme()` for the current `theme` and `setTheme`.
- Detect mount with `useSyncExternalStore` and constant snapshots (`true` on the client, `false` on the server) instead of `useEffect` plus `setState`; the server render and first client render must both use `"system"` to avoid a hydration mismatch.
- Render a `RadioGroup` with `value={mounted ? (theme ?? "system") : "system"}` and `onValueChange={setTheme}`, labelled "Appearance".
- Render three options in this order, each as a `RadioGroupItem` whose `id` matches a `Label`'s `htmlFor` and whose accessible name is exactly the label:

| Value | Label | Description |
|---|---|---|
| `light` | `Light` | Always use the light theme. |
| `dark` | `Dark` | Always use the dark theme. |
| `system` | `System` | Match this device's appearance. |

Modify `app/dashboard/settings/page.tsx` to add a Card between Notifications and Device lock:

- Title: `Appearance` with a `SunMoon` icon.
- Description: `Choose a theme for this browser, or match your device.`
- Content: `<AppearanceSettings />`.

Keep the existing `min-h-11` touch-target convention for any new control.

- [ ] **Step 5: Run the appearance test to verify it passes**

Run: `pnpm test:e2e e2e/theme.spec.ts`

Expected: PASS for the settings choice, reload persistence, system preference, and the guest-page fallback.

- [ ] **Step 6: Sweep both themes on every surface**

Run `pnpm dev` and, in both Light and Dark, check `/auth`, `/auth/check-email`, `/onboarding`, `/dashboard`, a locker detail page, `/dashboard/activity`, `/dashboard/settings`, and a `/share/<token>` page. Confirm text, borders, muted text, destructive actions, dialogs, the PIN pad, and the corrupted/expired share page stay legible. Set the OS to dark and reload `/share/not-a-real-token` in a fresh private window: it must open dark with no flash of light.

Then run:

```bash
grep -RInE "bg-(black|white)|text-(black|white)|#[0-9a-fA-F]{3,6}|rgb\(" --include='*.tsx' app components | grep -v 'components/ui/'
```

Expected: no matches, so every surface uses the CSS-variable tokens.

- [ ] **Step 7: Update the user-facing docs**

In `README.md`, add appearance to the MVP feature list: light, dark, or system theme, defaulting to the device preference and chosen in Settings.

In `docs/pilot-setup-guide.md`:

- Add a resident acceptance step: open Settings, switch to Dark, reload, confirm it persists, then switch back to System.
- Add a guest check: open the share link with the phone in dark mode and confirm the page is dark and readable.

The TTLock renumbering to Task 15 is already applied across the docs; introduce no new `Task 14` references that mean TTLock.

- [ ] **Step 8: Run the full verification**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`

Expected: lint clean, typecheck clean, all tests pass, build passes with TypeScript enforced, and every E2E test passes.

- [ ] **Step 9: Commit**

```bash
git add components/theme-provider.tsx components/appearance-settings.tsx app/layout.tsx app/dashboard/settings/page.tsx e2e/theme.spec.ts README.md docs/pilot-setup-guide.md
git commit -m "feat: add light, dark, and system appearance"
```
