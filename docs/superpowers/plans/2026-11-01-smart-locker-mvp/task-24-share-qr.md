# Task 24: Web Share and QR code for guest links

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Pilot hardening and growth design](../../specs/2026-11-03-smart-locker-pilot-hardening-design.md).
> Phase 2. **Depends on:** Task 06, Task 12.

---

**Files:**
- Create: `components/share-qr.tsx`
- Modify: `components/share-dialog.tsx`, `package.json`, `README.md`
- Test: `e2e/share-qr.spec.ts`

**Interfaces:**
- Consumes: `navigator.share`, `navigator.clipboard`, `next-themes` `useTheme`, the created share URL.
- Produces: a `Share…` action, a `Show QR code` action, and a client-only QR block with an accessible name.

**Non-goals:** No server-side QR image, no QR analytics, no QR scanning inside the app, and no change to the token format.

- [ ] **Step 1: Write the failing E2E test**

Create `e2e/share-qr.spec.ts`:

```ts
import { expect, test } from "@playwright/test"

test("a created share link can be shared through the OS and shown as a QR code", async ({ page, context }) => {
  await context.request.post("/api/test/session", { data: { email: "ana@example.com" } })
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        ;(window as unknown as { __shared: ShareData }).__shared = data
      },
    })
  })

  await page.goto("/dashboard")
  await page.getByRole("link", { name: "Locker details" }).click()
  await page.getByRole("button", { name: "Share access" }).click()
  await page.getByLabel("Guest label").fill("Cleaner")
  await page.getByRole("button", { name: "Create share link" }).click()

  const url = await page.getByTestId("share-url").inputValue()
  await page.getByRole("button", { name: "Share…" }).click()
  const shared = await page.evaluate(() => (window as unknown as { __shared: ShareData }).__shared)
  expect(shared.url).toBe(url)

  await page.getByRole("button", { name: "Show QR code" }).click()
  await expect(page.getByRole("img", { name: "QR code for the share link" })).toBeVisible()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:e2e e2e/share-qr.spec.ts`
Expected: FAIL because the Share… and QR controls do not exist.

- [ ] **Step 3: Add the QR dependency**

Run: `pnpm add qrcode.react`
Expected: `package.json` and `pnpm-lock.yaml` change. Do not use a hosted QR service.

- [ ] **Step 4: Build the QR component**

Create `components/share-qr.tsx`:

```tsx
"use client"

import { QRCodeSVG } from "qrcode.react"

export function ShareQr({ url }: { url: string }) {
  return (
    <div role="img" aria-label="QR code for the share link" className="mx-auto w-fit rounded-lg bg-white p-3">
      <QRCodeSVG value={url} size={192} level="M" bgColor="#ffffff" fgColor="#000000" />
    </div>
  )
}
```

Use a white quiet-zone container in both themes so the code stays scannable. Keep the QR local.

- [ ] **Step 5: Add the share and QR actions**

In `components/share-dialog.tsx`, after the created link:

- Add a `Share…` button. Render it only when `typeof navigator !== "undefined" && "share" in navigator`; the created state is already client-only, so there is no hydration mismatch.
- Call `navigator.share({ title: "Smart Locker access", text: `Access to ${lockerName}`, url: createdShare.url })`. Treat `AbortError` as a cancellation with no message; show `Sharing isn't available. Copy the link instead.` on other errors.
- Add a `Show QR code` / `Hide QR code` toggle button with `aria-expanded`.
- Render `<ShareQr url={createdShare.url} />` when shown.
- Keep the copy action and its live message.

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm test:e2e e2e/share-qr.spec.ts`
Expected: PASS.

- [ ] **Step 7: Update the README**

Add the OS share sheet and QR code to the MVP feature list. State that the QR is generated in the browser and is not sent to analytics.

- [ ] **Step 8: Run the full verification**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`
Expected: lint clean, typecheck clean, all tests pass, build passes, and every E2E test passes.

- [ ] **Step 9: Commit**

```bash
git add components/share-qr.tsx components/share-dialog.tsx package.json pnpm-lock.yaml e2e/share-qr.spec.ts README.md
git commit -m "feat: share guest links through the OS or a QR code"
```
