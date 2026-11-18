# Task 31: Form success toast notifications

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Pilot hardening and growth design](../../specs/2026-11-03-smart-locker-pilot-hardening-design.md).
> Phase 2. **Depends on:** Task 05, Task 06, Task 08, Task 09, Task 10, Task 22, Task 28, Task 29.

---

**Goal:** Confirm successful form and settings actions with the existing toast system, while keeping validation and failure messages inline.

**Files:**
- Modify: `components/profile-name-form.tsx`
- Modify: `components/locker-name-form.tsx`
- Modify: `components/guest-unlock-email-toggle.tsx`
- Modify: `components/pin-settings.tsx`
- Modify: `components/session-list.tsx`
- Modify: `components/extend-share-dialog.tsx`
- Modify: `e2e/global-setup.ts` (seed an unconfirmed user for onboarding toast coverage)
- Create: `e2e/form-toasts.spec.ts`
- Modify: `e2e/sessions.spec.ts`, `e2e/share-extension.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: the existing Radix toast stack: `toast` from `@/hooks/use-toast`, already mounted once as `<Toaster />` in `app/layout.tsx`. Do not add Sonner or a second provider.
- Produces: success notifications for the actions below, with errors still rendered inline.

| File | Current success feedback | Change |
|---|---|---|
| `profile-name-form.tsx` | `message` holds both success and validation errors | Split into `error`; toast `Display name updated.`; keep the error inline |
| `locker-name-form.tsx` | `saveMessage` holds success and validation errors | Split into `saveError`; toast `Locker name saved.`; keep the error inline |
| `guest-unlock-email-toggle.tsx` | `saved` boolean renders `Preference saved.` | Remove `saved`; toast `Preference saved.`; keep pending/error states |
| `pin-settings.tsx` | `message` mixes instructions and success text | Keep instructions inline; toast `PIN set for this device.` and `Device PIN removed.` |
| `session-list.tsx` | `message` renders revoke success | Toast `Other sessions revoked.` or `No other sessions to revoke.`; keep errors inline |
| `extend-share-dialog.tsx` | No success message; the dialog closes | Toast `Share link extended.` after a successful action |

**Non-goals:** No new toast library or visual redesign; no destructive/error toasts (validation and failures stay inline); no toast for redirect-only flows (magic link, sign-out, account deletion); no toast for share-link creation or the copy-link micro-interaction, where the created link or copy state is already the feedback.

**Audit exclusions (no change):**
- `components/share-dialog.tsx`: creation reveals the link and copy shows its own state; a toast would duplicate the feedback.
- `components/delete-account-dialog.tsx`: success redirects and deletes the session.
- `app/auth/page.tsx`: success redirects to `/auth/check-email` or `/api/auth/verify-request`.
- `app/dashboard/activity/page.tsx`: the filter is a GET navigation, not a saved mutation.
- `locker-name-form.tsx` confirmation: the all-confirmed case redirects, so a toast would be lost; the confirmed chip remains the success state.
- `app-lock.tsx`, `pin-pad.tsx`, and the guest unlock flow: progress/verification states, not form success.

- [ ] **Step 1: Seed the toast test user and write the failing E2E test**

In `e2e/global-setup.ts`, add a second provisioned resident next to `ana@example.com`:

```ts
await provisionApartment({
  email: "toast@example.com",
  gatewayId: "gw-toast",
  lockers: [{ name: "Toast locker", vendor: "mock", vendorLockId: "toast-lock-1" }],
})
```

Create `e2e/form-toasts.spec.ts`:

```ts
import { expect, test } from "@playwright/test"

test("successful form and settings actions use toast notifications", async ({ page, context }) => {
  await context.request.post("/api/test/session", { data: { email: "toast@example.com" } })

  await page.goto("/onboarding")
  await page.getByLabel("Locker name").fill("Kitchenette")
  await page.getByRole("button", { name: "Save name" }).click()
  await expect(page.getByText("Locker name saved.", { exact: true })).toBeVisible()

  await page.goto("/dashboard/settings")
  await page.getByLabel("Display name").fill("Toast Tester")
  await page.getByRole("button", { name: "Save name" }).click()
  await expect(page.getByText("Display name updated.", { exact: true })).toBeVisible()

  await page.getByRole("switch", { name: "Guest unlock emails" }).click()
  await expect(page.getByText("Preference saved.", { exact: true })).toBeVisible()
})

test("device PIN changes use toast notifications", async ({ page, context }) => {
  await context.request.post("/api/test/session", { data: { email: "toast@example.com" } })
  await page.goto("/dashboard/settings")

  await page.getByRole("button", { name: "Set a device PIN" }).click()
  for (let i = 0; i < 4; i += 1) await page.getByRole("button", { name: "1", exact: true }).click()
  for (let i = 0; i < 4; i += 1) await page.getByRole("button", { name: "1", exact: true }).click()
  await expect(page.getByText("PIN set for this device.", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Remove PIN" }).click()
  await expect(page.getByText("Device PIN removed.", { exact: true })).toBeVisible()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:e2e e2e/form-toasts.spec.ts`
Expected: FAIL because the success states are still inline and no toast text appears.

- [ ] **Step 3: Convert the profile and locker-name forms**

In `components/profile-name-form.tsx`:
- Replace `message`/`failed` with `error: string | null`.
- On success call `toast({ title: "Display name updated." })`.
- On failure set `error` and render it inline with `role="alert"`.
- Import `{ toast }` from `@/hooks/use-toast`.

In `components/locker-name-form.tsx`:
- Replace `saveMessage` with `saveError`.
- On success call `toast({ title: "Locker name saved." })`.
- Keep `confirmMessage` and the confirmed chip unchanged.
- Import `{ toast }`.

Run: `pnpm test:e2e e2e/form-toasts.spec.ts --grep "form and settings"`
Expected: PASS for the locker-name and profile toasts; the PIN test may still fail.

- [ ] **Step 4: Convert the guest-email toggle and PIN settings**

In `components/guest-unlock-email-toggle.tsx`:
- Remove the `saved` state and the `Preference saved.` inline branch.
- On success call `toast({ title: "Preference saved." })`.
- Keep the pending and error branches.

In `components/pin-settings.tsx`:
- Rename the `message` state to `instruction`; only use it for `Enter a new 4-digit PIN.` and `Enter the same PIN again to confirm it.`.
- On successful set call `toast({ title: "PIN set for this device." })`.
- If `sessionStorage` fails, call `toast({ title: "PIN saved.", description: "You’ll need to enter it again after refreshing this tab." })`.
- On remove call `toast({ title: "Device PIN removed." })`.
- Keep errors inline.
- Import `{ toast }`.

Run: `pnpm test:e2e e2e/form-toasts.spec.ts`
Expected: PASS.

- [ ] **Step 5: Convert the session and share-extension actions**

In `components/session-list.tsx`:
- Remove the `message` state and inline success paragraph.
- On success call `toast({ title: result.revoked > 0 ? "Other sessions revoked." : "No other sessions to revoke." })`.
- Keep errors inline and import `{ toast }`.

In `components/extend-share-dialog.tsx`:
- On a successful extension call `toast({ title: "Share link extended." })` before closing and refreshing.
- Keep the inline error branch.

Update `e2e/sessions.spec.ts` to assert the toast:

```ts
await expect(page.getByText("Other sessions revoked.", { exact: true })).toBeVisible()
```

Update `e2e/share-extension.spec.ts` to assert:

```ts
await expect(page.getByText("Share link extended.", { exact: true })).toBeVisible()
```

Run: `pnpm test:e2e e2e/sessions.spec.ts e2e/share-extension.spec.ts e2e/form-toasts.spec.ts`
Expected: PASS.

- [ ] **Step 6: Document the convention**

Add to `README.md` under the feature list or settings description:

```md
- Successful settings and form actions confirm with a toast; validation and failure messages stay inline.
```

- [ ] **Step 7: Run the full verification**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`
Expected: lint clean, typecheck clean, all unit tests pass, build passes, and every E2E test passes.

- [ ] **Step 8: Commit**

```bash
git add components/profile-name-form.tsx components/locker-name-form.tsx \
  components/guest-unlock-email-toggle.tsx components/pin-settings.tsx \
  components/session-list.tsx components/extend-share-dialog.tsx \
  e2e/global-setup.ts e2e/form-toasts.spec.ts e2e/sessions.spec.ts \
  e2e/share-extension.spec.ts README.md
git commit -m "feat: confirm form success with toast notifications"
```
