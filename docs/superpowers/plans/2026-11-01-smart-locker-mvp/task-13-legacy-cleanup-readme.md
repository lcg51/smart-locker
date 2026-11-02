# Task 13: Legacy cleanup, typecheck, lint, and README

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Smart Locker MVP — Design](../../specs/2026-11-01-smart-locker-mvp-design.md).
> Phase 1 (mock provider). **Depends on:** Task 01, Task 02, Task 03, Task 04, Task 05, Task 06, Task 07, Task 08, Task 09, Task 10, Task 11, Task 12.

---

**Files:**
- Delete: `lib/storage.ts`, `lib/bluetooth-service.ts`, `types/locker.ts`, `components/room-card.tsx`, `components/theme-provider.tsx`, `styles/globals.css`, `app/dashboard/notifications/page.tsx`
- Modify: `next.config.mjs`, `package.json`, `README.md`
- Create: `eslint.config.mjs`, `docs/pilot-setup-guide.md`

**Interfaces:**
- Consumes: everything.
- Produces: a clean build with no ignored type errors and setup documentation.

- [ ] **Step 1: Delete the demo-only code**

```bash
git rm lib/storage.ts lib/bluetooth-service.ts types/locker.ts components/room-card.tsx components/theme-provider.tsx styles/globals.css app/dashboard/notifications/page.tsx
```

- [ ] **Step 2: Stop ignoring TypeScript errors**

Replace `next.config.mjs` with:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
}

export default nextConfig
```

- [ ] **Step 3: Add ESLint and run the full check**

Create `eslint.config.mjs` extending `next/core-web-vitals` and `next/typescript` through `@eslint/eslintrc`'s `FlatCompat`, ignoring `.next`, `node_modules`, and generated Prisma files.

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: all pass. Fix any errors surfaced by the removed demo code.

- [ ] **Step 4: Write the README**

Document: what the product is, the Spain pilot, prerequisites (Node 22, pnpm, Docker), setup (`cp .env.example .env`, `docker compose up -d db`, `pnpm db:migrate`, `pnpm dev`), the test setup (`cp .env.test.example .env.test`, `pnpm test:db`, `pnpm test`, `pnpm test:e2e`), provisioning (`pnpm provision --email ... --gateway ... --locker ...`), the mock provider, the TTLock switch, and the security model (invite allowlist, hashed share tokens, PIN is not an authentication factor). Add a privacy and data-handling section: Spain/EU hosting, GDPR/LOPDGDD intent, hard account deletion, no audit retention after deletion, share links expire and are stored only as hashes, and guest pages expose no owner contact or vendor identifiers.

- [ ] **Step 5: Write the pilot setup guide**

Create `docs/pilot-setup-guide.md` for the person running the Spain pilot, covering:

1. **Hardware:** procure CE-marked locks compatible with the chosen vendor and one gateway per apartment; record each lock's vendor id.
2. **Vendor credentials:** create the vendor developer account, then run `pnpm tsx scripts/seed-vendor-credential.ts` with `TTLOCK_ACCESS_TOKEN` and `CREDENTIAL_ENCRYPTION_KEY` once Task 15 lands. Until then keep `LOCK_PROVIDER=mock`.
3. **Provision an apartment:** `pnpm provision --email resident@example.com --gateway gw-001 --locker "Kitchen:ttlock:12345"`; confirm the allowlist entry and locker rows.
4. **Deploy:** EU-region Postgres, `pnpm db:deploy`, then set `APP_URL`, `EMAIL_FROM`, and `RESEND_API_KEY` for the pilot domain.
5. **Resident acceptance:** the resident opens the magic link, confirms each locker on `/onboarding`, unlocks and locks once, and shares a link with a colleague.
6. **Guest check:** open the share link in iPhone Safari, unlock, confirm the owner receives the email alert, then revoke and confirm the link fails closed.
7. **Rollback:** set `LOCK_PROVIDER=mock`, revoke active grants, rotate vendor credentials, and tell residents the app is read-only.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove demo code, enforce typecheck, and document setup"
```
