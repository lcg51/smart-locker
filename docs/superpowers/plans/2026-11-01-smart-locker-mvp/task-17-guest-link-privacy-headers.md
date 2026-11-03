# Task 17: Guest-link privacy and security headers

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Pilot hardening and growth design](../../specs/2026-11-03-smart-locker-pilot-hardening-design.md).
> Phase 1.5. **Depends on:** Task 07, Task 12, Task 14.

---

**Files:**
- Modify: `next.config.mjs`
- Modify: `app/share/[token]/page.tsx`
- Test: `e2e/security-headers.spec.ts`
- Modify: `README.md`, `docs/pilot-setup-guide.md`

**Interfaces:**
- Consumes: the existing `/share/[token]` route, `metadata.referrer`, and the `SafeAnalytics` suppression.
- Produces: global security headers, route-specific no-store/noindex headers, and share-page robots metadata.

**Non-goals:** No nonce-based CSP migration, no WAF, no CORS changes, and no change to the share-token format.

- [ ] **Step 1: Write the failing header test**

Create `e2e/security-headers.spec.ts`:

```ts
import { expect, test } from "@playwright/test"

test("guest and private pages send privacy headers", async ({ request, page }) => {
  const share = await request.get("/share/not-a-real-token")
  expect(share.status()).toBe(200)
  expect(share.headers()["x-robots-tag"]).toContain("noindex")
  expect(share.headers()["cache-control"]).toContain("no-store")
  expect(share.headers()["referrer-policy"]).toBe("no-referrer")
  expect(share.headers()["x-frame-options"]).toBe("DENY")
  expect(share.headers()["content-security-policy"]).toContain("frame-ancestors 'none'")

  await page.goto("/share/not-a-real-token")
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:e2e e2e/security-headers.spec.ts`
Expected: FAIL because the headers are absent.

- [ ] **Step 3: Add the headers**

In `next.config.mjs`, add an `async headers()` function with:

```js
const isDev = process.env.NODE_ENV === "development"
const csp = [
  "default-src 'self'",
  `script-src 'self'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ")

const common = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Content-Security-Policy", value: csp },
]

return [
  { source: "/:path*", headers: common },
  {
    source: "/share/:path*",
    headers: [
      { key: "Cache-Control", value: "no-store, max-age=0" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
      { key: "Referrer-Policy", value: "no-referrer" },
    ],
  },
  {
    source: "/(dashboard|auth|onboarding)/:path*",
    headers: [
      { key: "Cache-Control", value: "no-store, max-age=0" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ],
  },
]
```

If the production build needs `'unsafe-inline'` in `script-src` for Next's bootstrap scripts, add it with a comment explaining why; keep `frame-ancestors 'none'` regardless. Verify the app loads with no CSP console errors before accepting the policy.

- [ ] **Step 4: Add the share-page robots metadata**

In `app/share/[token]/page.tsx`:

```ts
export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false, nocache: true },
}
```

Keep the existing `no-referrer` metadata.

- [ ] **Step 5: Run the header test to verify it passes**

Run: `pnpm test:e2e e2e/security-headers.spec.ts`
Expected: PASS for the share page. Manually load `/auth` and a signed-in `/dashboard` with DevTools and confirm the no-store/noindex headers.

- [ ] **Step 6: Update the docs**

- `README.md`: add a short "Security headers" bullet to the security model.
- `docs/pilot-setup-guide.md`: add a deployment check for the share-page headers and explain that the share token must never be indexed or cached.

- [ ] **Step 7: Run the full verification**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`
Expected: lint clean, typecheck clean, all tests pass, build passes, and every E2E test passes.

- [ ] **Step 8: Commit**

```bash
git add next.config.mjs app/share/[token]/page.tsx e2e/security-headers.spec.ts README.md docs/pilot-setup-guide.md
git commit -m "fix: protect guest links with privacy headers"
```
