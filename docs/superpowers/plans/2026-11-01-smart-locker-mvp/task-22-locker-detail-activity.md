# Task 22: Per-locker activity and controls

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Pilot hardening and growth design](../../specs/2026-11-03-smart-locker-pilot-hardening-design.md).
> Phase 2. **Depends on:** Task 05, Task 06, Task 08, Task 10.

---

**Files:**
- Create: `lib/events/presentation.ts`, `hooks/use-locker-command.ts`
- Create: `components/locker-detail-controls.tsx`, `components/locker-activity.tsx`
- Modify: `components/locker-card.tsx` (use the shared hook)
- Modify: `lib/events/queries.ts` (include the grant's guest label)
- Modify: `app/dashboard/lockers/[id]/page.tsx`
- Modify: `app/dashboard/activity/page.tsx`
- Test: `tests/events/presentation.test.ts`, `tests/events/queries.test.ts`, `e2e/locker-detail.spec.ts`

**Interfaces:**
- Consumes: `unlockLocker`, `lockLocker`, `/api/lockers/[id]/state`, `listLockEvents`, `Locker` record.
- Produces:
  - `formatEventTime(date: Date, locale?: "en" | "es"): string` using `Europe/Madrid`.
  - `describeEvent(event: { actorType, grant: { guestLabel: string | null } | null, action, success, errorCode }): { actor: string; action: string; result: string; detail: string | null }`
  - `useLockerCommand(locker: Locker)` returning `{ state, isPending, actionError, refreshError, nextCommand, nextLabel, runCommand, refreshState }`.
  - Locker detail page with recent activity and controls.

**Non-goals:** No per-event pagination on the detail page beyond the latest ten, no export, and no change to the owner command authorization path.

- [ ] **Step 1: Write the failing presentation tests**

Create `tests/events/presentation.test.ts`:

```ts
it("formats event time in Madrid time with a timezone label", () => {
  const text = formatEventTime(new Date("2026-11-03T10:00:00.000Z"))
  expect(text).toContain("11:00")
  expect(text).toMatch(/CET|CEST|GMT\+1|GMT\+2/)
})

it("uses the guest label and a friendly failure reason", () => {
  expect(describeEvent({
    actorType: "GUEST",
    grant: { guestLabel: "Cleaner" },
    action: "UNLOCK",
    success: false,
    errorCode: "provider_error",
  })).toEqual({
    actor: "Cleaner",
    action: "Unlock",
    result: "Failed",
    detail: "The lock provider did not respond.",
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/events/presentation.test.ts`
Expected: FAIL because the presentation helpers do not exist.

- [ ] **Step 3: Add the presentation helpers**

Create `lib/events/presentation.ts`:

- `formatEventTime` uses `Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid", timeZoneName: "short" })`.
- `describeEvent` maps `OWNER` to `Resident`, `GUEST` to the grant label or `Guest`, and `SYSTEM` to `System`; maps `UNLOCK`/`LOCK`; maps `errorCode` through a small record (`provider_error`, `unknown_lock`, `not_found`, `rate_limited`) and falls back to `The locker did not respond.` for unknown codes.
- Keep the helper pure and server/client safe.

- [ ] **Step 4: Include the guest label in event queries**

In `lib/events/queries.ts`, add:

```ts
include: { grant: { select: { guestLabel: true } } }
```

Keep the existing cursor, limit, and owner filter. Update `tests/events/queries.test.ts` to assert a guest event resolves the label and an owner event has `grant: null`.

- [ ] **Step 5: Extract the owner command hook**

Create `hooks/use-locker-command.ts` with the state, polling, refresh, and command logic currently in `components/locker-card.tsx`. Keep the current behavior:

- Initial state from the `Locker` record.
- Poll `/api/lockers/[id]/state` every 30 seconds while visible.
- Refresh on mount.
- `runCommand` calls `unlockLocker`/`lockLocker`, sets the returned state, and calls `router.refresh()`.
- Map every error code, including `rate_limited` from Task 19 and `commands_disabled` from Task 21.

Refactor `components/locker-card.tsx` to use the hook. The card's rendered output must not change except for new health warnings from Task 25.

- [ ] **Step 6: Add the detail controls**

Create `components/locker-detail-controls.tsx` as a client component:

- Show status, battery, online state, and `lastSyncedAt` (`Last checked …` or `Not checked yet`).
- Show the primary Lock/Unlock button and a `Refresh status` button.
- Show the action error with a retry action, matching the card.
- Accept the `Locker` record as its only prop and use `useLockerCommand`.

Add it to `app/dashboard/lockers/[id]/page.tsx` below the header and above the share section.

- [ ] **Step 7: Add the recent activity list**

Create `components/locker-activity.tsx` (server component is fine) that receives the events and renders:

- `Time`, `Actor`, `Action`, `Result`, and a detail line.
- Empty state: `No activity for this locker yet.`
- A link to `/dashboard/activity?lockerId=<id>` labelled `View all activity`.

In `app/dashboard/lockers/[id]/page.tsx`, fetch `listLockEvents({ userId: user.id, lockerId: locker.id, limit: 10 })` and render the list below the controls.

- [ ] **Step 8: Use the presentation helper on the full activity page**

Modify `app/dashboard/activity/page.tsx` to use `formatEventTime` and `describeEvent`. Show the guest label in the Actor column and the failure detail below the result badge. Keep the existing locker filter, pagination, and empty state.

- [ ] **Step 9: Add the E2E test**

Create `e2e/locker-detail.spec.ts`:

```ts
test("the locker detail page shows controls and recent activity", async ({ page, context }) => {
  await context.request.post("/api/test/session", { data: { email: "ana@example.com" } })
  await page.goto("/dashboard")
  await page.getByRole("link", { name: "Locker details" }).click()
  await expect(page.getByRole("button", { name: "Unlock" })).toBeVisible()
  await page.getByRole("button", { name: "Unlock" }).click()
  await expect(page.getByText("Unlocked")).toBeVisible()
  await expect(page.getByText("Resident")).toBeVisible()
  await expect(page.getByText("Succeeded")).toBeVisible()
  await page.getByRole("button", { name: "Lock" }).click()
  await expect(page.getByText("Locked")).toBeVisible()
})
```

Run: `pnpm test:e2e e2e/locker-detail.spec.ts`
Expected: PASS.

- [ ] **Step 10: Run the full verification**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`
Expected: lint clean, typecheck clean, all tests pass, build passes, and every E2E test passes.

- [ ] **Step 11: Commit**

```bash
git add lib/events hooks components app/dashboard tests/events e2e/locker-detail.spec.ts
git commit -m "feat: show per-locker activity and controls"
```
