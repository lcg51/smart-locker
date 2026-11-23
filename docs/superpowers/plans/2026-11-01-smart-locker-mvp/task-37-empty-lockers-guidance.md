# Task 37: Empty-state guidance for residents without lockers

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Pilot hardening and growth design](../../specs/2026-11-03-smart-locker-pilot-hardening-design.md) §21.
> Phase 2. **Depends on:** Task 05, Task 10, Task 27.

---

**Files:**
- Create: `components/empty-lockers.tsx`
- Test: `e2e/empty-lockers.spec.ts`
- Modify: `app/dashboard/page.tsx`
- Modify: `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/es.ts`
- Modify: `README.md`, `docs/pilot-setup-guide.md`

**Interfaces:**
- Consumes: `useRouter()`, `useI18n()`, `signIn`/`/api/test/session` in E2E, `prisma`.
- Produces:
  - `EmptyLockers` client component with a reload action.
  - `dictionary.dashboard.emptyHint` and `dictionary.dashboard.emptyReload`.

**Non-goals:** No self-service locker assignment, no admin UI, no resident-to-
administrator messaging, and no change to provisioning. The empty state only
explains the next step and rechecks the page.

- [ ] **Step 1: Write the failing E2E test**

Create `e2e/empty-lockers.spec.ts`:

```ts
import { expect, test } from "@playwright/test"
import { prisma } from "../lib/db"
import { signIn } from "./helpers"

const EMAIL = "empty@example.com"

test.beforeEach(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } })
  await prisma.user.create({ data: { email: EMAIL } })
})

test.afterEach(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } })
})

test("a resident with no lockers sees the next step and can recheck", async ({ browser }) => {
  const context = await browser.newContext({ locale: "en-GB" })
  const page = await context.newPage()
  await signIn(context, EMAIL)

  await page.goto("/dashboard")
  await expect(page.getByRole("heading", { name: "No lockers yet" })).toBeVisible()
  await expect(page.getByText("Your building administrator assigns lockers to your apartment.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Check again" })).toBeVisible()

  await context.close()
})

test("the empty state follows the Spanish locale", async ({ browser }) => {
  const context = await browser.newContext({ locale: "es-ES" })
  const page = await context.newPage()
  await signIn(context, EMAIL)

  await page.goto("/dashboard")
  await expect(page.getByRole("heading", { name: "Aún no hay taquillas" })).toBeVisible()
  await expect(page.getByText("La administración del edificio asigna las taquillas de tu vivienda.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Volver a comprobar" })).toBeVisible()

  await context.close()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:e2e e2e/empty-lockers.spec.ts`

Expected: FAIL. The dashboard shows the old empty body and has no button.

- [ ] **Step 3: Add the copy and the component**

English `dashboard` additions:

```ts
emptyHint: "Your building administrator assigns lockers to your apartment.",
emptyReload: "Check again",
emptyChecking: "Checking…",
```

Spanish:

```ts
emptyHint: "La administración del edificio asigna las taquillas de tu vivienda.",
emptyReload: "Volver a comprobar",
emptyChecking: "Comprobando…",
```

Create `components/empty-lockers.tsx`:

```tsx
"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Box, RefreshCw } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"

export function EmptyLockers() {
  const { dictionary } = useI18n()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <section aria-labelledby="empty-lockers-title" className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <Box aria-hidden="true" className="mx-auto size-9 text-muted-foreground" />
      <h2 id="empty-lockers-title" className="mt-4 text-lg font-semibold">
        {dictionary.dashboard.emptyTitle}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {dictionary.dashboard.emptyHint}
      </p>
      <Button
        className="mt-5 min-h-11"
        disabled={isPending}
        onClick={() => startTransition(() => router.refresh())}
        type="button"
        variant="outline"
      >
        <RefreshCw aria-hidden="true" className="size-4" />
        {isPending ? dictionary.dashboard.emptyChecking : dictionary.dashboard.emptyReload}
      </Button>
    </section>
  )
}
```

Replace the inline empty state in `app/dashboard/page.tsx` with `<EmptyLockers />`
and drop the now-unused `Box` import. Keep the existing `emptyTitle`; replace the
old `emptyBody` with `emptyHint` in the dictionary or delete `emptyBody` if it has
no other use.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:e2e e2e/empty-lockers.spec.ts`

Expected: PASS.

- [ ] **Step 5: Document the support path**

Add to `README.md` troubleshooting and `docs/pilot-setup-guide.md` acceptance:

- A resident with no lockers sees "No lockers yet" and the building-administrator
  instruction.
- After the operator provisions the lockers, tapping **Check again** shows them
  without a sign-out.
- The empty state never shows vendor names, the owner email, or another
  resident's data.

- [ ] **Step 6: Run the full verification**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add components/empty-lockers.tsx app/dashboard/page.tsx lib/i18n e2e/empty-lockers.spec.ts README.md docs/pilot-setup-guide.md
git commit -m "feat: guide residents who have no lockers yet"
```

---

## Review focus

- The empty state is a resident surface: it may name the building administrator
  but must not expose vendor identifiers or guest data.
- The reload action must re-run the server page, not just the client tree.
- Both languages must use the same layout and the `min-h-11` touch target.
