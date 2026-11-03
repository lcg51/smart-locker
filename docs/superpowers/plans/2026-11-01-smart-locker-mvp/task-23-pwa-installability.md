# Task 23: PWA installability and offline fallback

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Pilot hardening and growth design](../../specs/2026-11-03-smart-locker-pilot-hardening-design.md).
> Phase 2. **Depends on:** Task 13, Task 14.

---

**Files:**
- Create: `app/manifest.ts`, `app/offline/page.tsx`, `components/service-worker.tsx`
- Create: `public/sw.js`, `scripts/generate-pwa-icons.ts`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png`
- Modify: `app/layout.tsx`, `next.config.mjs`, `package.json`, `README.md`, `docs/pilot-setup-guide.md`
- Test: `e2e/pwa.spec.ts`

**Interfaces:**
- Consumes: `public/icon.svg` (the existing lock mark), Next metadata routes, the root layout.
- Produces:
  - `/manifest.webmanifest` with stable name, start URL, standalone display, and three icons.
  - `/offline` static fallback page.
  - `/sw.js` registered only in production.
  - `pnpm icons` regenerating the PNGs from `public/icons/source.svg`.

**Non-goals:** No offline unlocking, no background sync, no push notifications, and no caching of authenticated or share pages.

- [ ] **Step 1: Write the failing manifest test**

Create `e2e/pwa.spec.ts`:

```ts
import { expect, test } from "@playwright/test"

test("the app exposes an installable manifest and icons", async ({ request, page }) => {
  const manifest = await request.get("/manifest.webmanifest")
  expect(manifest.status()).toBe(200)
  const body = await manifest.json()
  expect(body).toMatchObject({
    name: "Smart Locker",
    short_name: "Smart Locker",
    start_url: "/dashboard",
    display: "standalone",
  })
  expect(body.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: "192x192" }),
    expect.objectContaining({ sizes: "512x512" }),
    expect.objectContaining({ purpose: "maskable" }),
  ]))

  const icon = await request.get("/icons/icon-192.png")
  expect(icon.headers()["content-type"]).toContain("image/png")

  await page.goto("/offline")
  await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:e2e e2e/pwa.spec.ts`
Expected: FAIL because the manifest, icons, and offline page do not exist.

- [ ] **Step 3: Add the manifest and offline page**

Create `app/manifest.ts`:

```ts
import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Smart Locker",
    short_name: "Smart Locker",
    description: "Manage your apartment lockers and share temporary guest access.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
```

Create `app/offline/page.tsx` with a static heading `You are offline`, a short explanation that unlocking needs a connection, and a link to `/dashboard`.

- [ ] **Step 4: Generate the icons**

Create a fixed-color source `public/icons/source.svg` based on the existing lock mark (do not rely on `prefers-color-scheme` inside a PNG-rendered SVG). Add `sharp` as a devDependency and `scripts/generate-pwa-icons.ts` that renders 192, 512, and a 512 maskable icon with the required safe-area padding. Add:

```json
"icons": "tsx scripts/generate-pwa-icons.ts"
```

Run `pnpm icons` and commit the three PNGs.

- [ ] **Step 5: Add the service worker**

Create `public/sw.js` with a versioned cache:

- Install caches `/offline`, `/icon.svg`, and `/manifest.webmanifest`; call `skipWaiting()`.
- Activate calls `clients.claim()`.
- Fetch returns early for non-GET, cross-origin, `/dashboard`, `/share/`, `/auth`, `/onboarding`, and `/api/`.
- Navigation requests are network-first with `caches.match("/offline")` as the fallback.
- Static requests under `/_next/static/`, `/icons/`, and `/icon.svg` are cache-first with a background cache update.
- Never cache a guest share page or any authenticated response.

Create `components/service-worker.tsx`:

```tsx
"use client"

import { useEffect } from "react"

export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return
    void navigator.serviceWorker.register("/sw.js").catch(() => {})
  }, [])
  return null
}
```

Render `<ServiceWorker />` in `app/layout.tsx` inside `<body>`.

- [ ] **Step 6: Add the service-worker headers**

In `next.config.mjs`, add:

```js
{
  source: "/sw.js",
  headers: [
    { key: "Cache-Control", value: "no-cache" },
    { key: "Service-Worker-Allowed", value: "/" },
  ],
},
```

Keep the Task 17 headers intact.

- [ ] **Step 7: Run the manifest test to verify it passes**

Run: `pnpm test:e2e e2e/pwa.spec.ts`
Expected: PASS.

- [ ] **Step 8: Do the production offline check manually**

Run:

```bash
pnpm build
pnpm start
```

Open the app, confirm the service worker registers in DevTools, go offline, and load a previously visited public page. Confirm `/dashboard` and a share page do not render from the cache. Record the result in the task report.

- [ ] **Step 9: Update the docs**

- `README.md`: add PWA installability and the offline limitation (no offline unlocking).
- `docs/pilot-setup-guide.md`: add an iPhone Safari "Add to Home Screen" acceptance step and a note that the service worker never caches locker or share pages.

- [ ] **Step 10: Run the full verification**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`
Expected: lint clean, typecheck clean, all tests pass, build passes, and every E2E test passes.

- [ ] **Step 11: Commit**

```bash
git add app/manifest.ts app/offline components/service-worker.tsx public/sw.js public/icons scripts/generate-pwa-icons.ts package.json app/layout.tsx next.config.mjs e2e/pwa.spec.ts README.md docs/pilot-setup-guide.md
git commit -m "feat: make the app installable as a PWA"
```
