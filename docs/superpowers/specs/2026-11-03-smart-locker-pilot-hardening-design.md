# Smart Locker Pilot Hardening and Growth — Design

Date: 2026-11-03
Status: Approved for planning (user, 2026-11-03)
Spec of record for Tasks 16–30.

## Intent

The MVP works end to end against `MockLockProvider`, and Tasks 01–14 are merged.
This design closes the gap between what the current UI promises and what the
server actually does, hardens the bearer-link privacy and operational model
before pilot residents are invited, and registers the highest-value product
work that follows. It does not change the MVP's product boundaries.

The immediate trigger is a correctness bug: the guest page says the locker will
relock automatically in 30 seconds, but no server code locks it. The guest page
and its E2E test assert a promise the system does not keep. That is a safety
bug, not a feature request, and it is Task 16.

## Goals

1. **Safety.** A guest unlock relocks; a failed relock is visible to the guest,
   recorded as a system event, and retryable.
2. **Privacy.** Bearer-token pages are not indexed, cached, or framed; the app
   sends real security headers; expired data has a retention policy.
3. **Operability.** Every PR runs the full gate; operators can stop sharing or
   lock commands, bulk-revoke links, read pilot metrics, and see unhealthy
   lockers.
4. **UX.** The locker detail page shows its own activity and controls; guest
   links can be shared through the OS share sheet or a QR code; the app is
   installable as a PWA.
5. **Reach.** The resident and guest UI can be used in Spanish after the
   pilot-critical work is complete.

## Non-goals

- Native iOS/Android apps, building-wide management, billing, self-serve signup.
- Per-guest vendor e-keys, offline or direct BLE unlocking, hardware changes.
- The TTLock integration itself; Task 15 remains the vendor-provider task.
- A visual redesign. New surfaces use the existing tokens and components.
- Account-wide theme sync; appearance stays per browser.
- Changing the share-token format or the server-side authorization model.

## Constraints

- Pilot market is Spain. Data handling meets GDPR and LOPDGDD; Postgres runs in
  an EU region where available.
- Invite-only sign-in; one resident per account; guests need no account.
- Guest pages never expose owner contact details or vendor identifiers.
- Share tokens stay 32 random bytes, returned once and stored as SHA-256 hashes.
- Share defaults stay 60 minutes and 5 uses; caps stay 1440 minutes and 50 uses.
- **Guest unlocks auto-relock after 30 seconds. Owner unlocks stay manual.**
  This refines the MVP's unqualified "the lock auto-relocks" constraint.
- The PIN remains a local convenience lock, never an authentication factor.
- Keep Next.js 16 App Router, React 19, TypeScript strict, Prisma 6.19.3,
  Tailwind v4, shadcn/ui, Vitest, and Playwright.
- The guest page must work on iPhone Safari with no install step.
- English is the first pilot language; Spanish is Task 27.
- Every task is TDD except pure configuration or documentation. Those tasks
  must still carry a checkable verification command and a manual acceptance
  step.

## What changed since the MVP design

- Task 14 added Light/Dark/System appearance; Task 16 must not regress it.
- PR #16 restored Geist loading; do not remove the `next/font` wiring.
- The guest page's 30-second message is currently a client-only countdown. There
  is no `lock` call after a guest redeem, and the mock locker stays unlocked.
- There is no CI configuration, PWA manifest, privacy page, retention job,
  per-locker activity, health warning, or metrics report.
- Task 15 (TTLock) is still blocked on vendor credentials and a test lock.

## Approaches considered

1. **Pilot-critical first, then UX, then growth (chosen).** Fix the false
   relock promise, bearer-link exposure, and missing operational guardrails
   before inviting residents; add the detail-page and sharing improvements
   while the pilot runs; translate to Spanish after the English flow is stable.
   Cost: the visible feature work lands later. Benefit: the pilot does not
   start on a false safety claim.
2. **Feature-first.** Build PWA, QR sharing, Spanish, and metrics first.
   Rejected: it leaves a guest-unlock safety bug and an exposed bearer-token
   page in the pilot.
3. **A hardening rewrite.** Rework auth, shares, and the schema in one branch.
   Rejected: too much risk for a working MVP and impossible to review as one
   change.

## Decisions

### 1. Guest auto-relock (Task 16)

- Add `Locker.relockAt DateTime?`.
- A successful guest redeem sets `relockAt = now + RELOCK_SECONDS` (default 30).
- `redeemShareToken` returns the deadline. The share page passes it to
  `GuestUnlock`, which counts down to the server-provided deadline rather than a
  hardcoded 30.
- At zero, the guest page calls `relockShare(token)`. That function resolves the
  grant by token hash, locks the locker, clears `relockAt`, and writes a
  `SYSTEM` / `LOCK` event. It is idempotent.
- A failed relock shows a retry action and records a failed `SYSTEM` / `LOCK`
  event. The page never claims success without the server result.
- `relockDueLockers({ now, provider })` relocks any locker whose `relockAt` is
  due. `/api/cron/relock` calls it every minute, protected by `CRON_SECRET`.
  This catches guests who close the tab before the client timer fires.
- A reloaded share page shows the remaining countdown if `relockAt` is still in
  the future. It does not offer another unlock until the countdown ends.
- Owner unlock does not set `relockAt`; the owner has an explicit lock control.
- `RELOCK_SECONDS` is an env value defaulting to 30. Tests set it to 1.
- Limitation: the client action is exact while the tab is open; the cron sweeper
  closes abandoned tabs within about a minute. QStash or a vendor-side auto-lock
  can replace the sweeper later.

### 2. Guest-link privacy and security headers (Task 17)

- Global headers: `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `X-Frame-Options: DENY`, a restrictive `Permissions-Policy`, and a
  `Content-Security-Policy` with `frame-ancestors 'none'`, `base-uri 'self'`,
  and `form-action 'self'`.
- The CSP is production-oriented and allows the app's own scripts, styles,
  fonts, images, and same-origin analytics calls. Development adds the
  `unsafe-eval`/WebSocket allowances Next.js needs. Do not add `unsafe-inline`
  to `script-src` unless the framework build requires it; if it does, record
  why and keep `frame-ancestors 'none'`.
- `/share/:path*` adds `Cache-Control: no-store, max-age=0` and
  `X-Robots-Tag: noindex, nofollow, noarchive`.
- `/dashboard/:path*`, `/auth/:path*`, and `/onboarding` add `no-store` and
  `noindex` so private pages are not indexed or cached by intermediaries.
- The share page's Next metadata sets `robots: { index: false, follow: false }`
  and keeps `referrer: "no-referrer"`.
- The existing analytics suppression on `/share/*` and the `no-referrer` policy
  stay in place.

### 3. CI quality gate (Task 18)

- GitHub Actions runs on pull requests and pushes to `dev`.
- The `verify` job runs `pnpm lint`, `pnpm typecheck`, `pnpm test`, and
  `pnpm build`.
- The `e2e` job starts a PostgreSQL service, provisions the `_test` database,
  installs Chromium, and runs `pnpm test:e2e`.
- Pin Node 22 in CI and `.nvmrc`; pin pnpm 12.16.1 through `packageManager`.
- CI uses the same `_test` database guard and must not point at a pilot database.
- `actionlint` checks the workflow file.

### 4. Abuse and rate-limit hardening (Task 19)

- Magic-link requests: 5 per 10 minutes per normalized email and 20 per 10
  minutes per client IP. A limited request gets the same generic
  "check your email" page, so the response does not reveal allowlist membership.
- Share creation: 10 per hour per resident and at most 20 active grants per
  locker. A blocked creation returns a typed error the dialog can show.
- Owner unlock/lock: 30 per minute per resident.
- Guest redemption keeps 10 per minute per IP and 20 per minute per token.
- Limit checks run before the vendor call and before writing a grant. Inject the
  limiter in services so tests use a deterministic in-memory instance.
- These limits are abuse controls, not authentication. They must not change the
  guest failure copy.

### 5. Privacy pack and retention (Task 20)

- Add a `/privacy` page in English and Spanish-ready structure, linked from
  `/auth` and Settings. It covers controller/contact, data collected, purposes,
  legal bases, processors, retention, rights, cookies/local storage, and the
  fact that analytics pageviews are suppressed on share pages.
- Retention: delete expired or revoked grants 30 days after they become
  inactive; delete expired sessions and verification tokens 30 days after
  expiry; delete lock events after 12 months. Account deletion remains
  immediate and hard.
- `cleanupExpiredData({ now, retention })` is a tested service.
  `/api/cron/cleanup` calls it daily and is protected by `CRON_SECRET`.
- Add `docs/privacy/processor-region-checklist.md` with one row per processor
  (Vercel, Postgres host, Resend, Upstash, TTLock, analytics), region, DPA
  status, subprocessors, transfer mechanism, owner, and review date.
- The checklist is an operator artifact, not legal advice. A lawyer reviews the
  policy before the pilot.

### 6. Emergency controls (Task 21)

- `SHARING_ENABLED` defaults to `true`. When `false`, creating and redeeming
  shares is blocked, but revoking and locking still work.
- `LOCK_COMMANDS_ENABLED` defaults to `true`. When `false`, owner and guest
  unlocks are blocked, but locking still works.
- Both are read through `lib/ops/controls.ts`, not scattered `process.env`
  checks. Limit checks and vendor calls do not run when a control is off.
- `bulk-revoke` CLI revokes grants by `--email` or `--all`; it requires `--yes`.
- The pilot guide's rollback section documents the switches, the CLI, and the
  expected user-facing behavior.

### 7. Per-locker activity and controls (Task 22)

- The locker detail page gets manual lock/unlock, refresh, last-synced time, and
  the ten most recent events for that locker.
- It reuses the existing owner command service and state endpoint; do not add a
  second authorization path.
- Event rows show time in `Europe/Madrid`, actor (`Resident`, `Guest`, or
  `System`), the guest label when present, the action, the result, and a
  friendly failure reason.
- The full activity page uses the same formatter and exposes the same fields.
- The detail page links to the full filtered activity page.

### 8. PWA installability and offline fallback (Task 23)

- Add `app/manifest.ts` with name, short name, description, start URL
  `/dashboard`, standalone display, theme/background colors, and 192, 512, and
  maskable icons.
- Generate the PNG icons from the existing lock mark with a committed script.
- Add `app/offline/page.tsx` and a minimal `public/sw.js`.
- The service worker caches only static assets and the offline page. It never
  caches `/dashboard`, `/share/*`, `/auth`, `/onboarding`, or `/api/*`. It does
  not enable offline unlocking.
- Register the service worker in production only. Dev keeps the current
  no-service-worker behavior.
- The manifest and icons are testable; the offline behavior gets a manual
  production check in the pilot guide.

### 9. Web Share and QR code (Task 24)

- The created-share dialog offers `Share…` through `navigator.share` when
  available and the existing copy action as fallback.
- It renders a QR code for the link. The QR is generated in the browser and is
  never sent to analytics or logged.
- Use `qrcode.react`; do not add a QR service or a network round trip.
- The QR and share button are keyboard reachable and have accessible names.

### 10. Battery and gateway health warnings (Task 25)

- `getLockerHealth` returns `ok`, `warning`, or `critical` plus reasons.
- Battery at or below 20% is a warning; at or below 10% is critical.
- A locker is offline when the provider says `online: false` or the resident's
  `gatewayLastSeenAt` is older than 15 minutes. Unknown data is not an alert.
- The dashboard shows a warning banner linking to affected lockers; locker cards
  and the detail page show the reason.
- This lands after Task 15 for real gateway timestamps, but the UI is null-safe
  and can be built against seeded mock data.

### 11. Pilot metrics report (Task 26)

- `pnpm metrics --from YYYY-MM-DD --to YYYY-MM-DD` prints a Markdown report and
  JSON. The default window is the last 28 days.
- Metrics: active residents, owner unlocks, guest unlocks, failed unlocks,
  unlock success rate, shares created, shares redeemed, share conversion, and
  expired/revoked counts.
- The report is read-only and queries the database directly. It does not add
  client analytics and does not touch `/share/*` tracking.
- Definitions and the mapping to the MVP success signals live in
  `docs/pilot-metrics.md`.

### 12. Spanish localization (Task 27)

- Add a small typed dictionary and locale layer rather than a routing rewrite:
  `en` and `es` dictionaries, a `NEXT_LOCALE` cookie for residents, and
  `Accept-Language` for guests.
- `app/layout.tsx` sets `<html lang>` and provides the dictionary to client
  components. A Settings → Language card writes the cookie.
- Translate resident and guest UI strings, validation messages, metadata, and
  the guest-unlock email. Add `User.locale` so the owner's email uses their
  chosen language.
- Dates use `Europe/Madrid` and the active locale. The guest page has no
  language picker, matching the no-theme-control rule.
- English remains the fallback for missing keys; a test asserts both dictionaries
  have the same keys.
- This is Phase 3 and can be split into a resident pass and a guest/email pass
  if the branch grows too large.

### 13. Session management and profile editing (Task 28)

- Add `Session.createdAt` and show active sessions with their creation and
  expiry times. Identify "this device" from the Auth.js session cookie.
- A resident can revoke every other session. Sign-out still revokes the current
  session.
- Add display-name editing with the same validation and pending-state rules as
  locker renaming. Email change is out of scope because it needs a verification
  flow.
- Do not store or display raw IP addresses or full user-agent strings.

### 14. Share lifecycle audit and link extension (Task 29)

- Add `ShareGrantEvent` with `CREATED`, `REVOKED`, and `EXTENDED` actions and an
  optional detail string. The service writes events in the same transaction as
  the grant change.
- The locker detail page shows the share history alongside lock events.
- An owner can extend a live grant by minutes and/or uses. The new expiry is
  capped at 1440 minutes from the extension time; `maxUses` stays at or below
  50 and cannot fall below `usedCount`.
- Extension never revives a revoked or expired grant; the owner creates a new
  link instead.
- The raw token is never stored, so the history cannot show the link itself.

### 15. Accessibility and security E2E coverage (Task 30)

- Add `@axe-core/playwright` and run axe on `/auth`, `/dashboard`,
  `/dashboard/settings`, a locker detail page, and a guest share page. Fail on
  serious or critical violations.
- Add keyboard checks for the theme radio group, the share dialog, and the
  delete-account alert dialog.
- Add security E2E cases for an expired link, a revoked link, a replayed
  one-use link, cross-user locker access, guest-page leakage, the privacy
  headers, and the noindex metadata.
- Use the existing test-session route and Prisma fixtures; do not add a new
  production backdoor.

## Task map

| # | Task | Phase | Depends on | Acceptance in one line |
|---|------|-------|------------|------------------------|
| 16 | Guest unlock auto-relock | 1.5 | 03, 07, 08, 12 | A guest unlock relocks within the deadline and the page never claims an unverified relock. |
| 17 | Guest-link privacy and security headers | 1.5 | 07, 12, 14 | Share pages and private app routes send noindex/no-store/frame protections. |
| 18 | CI quality gate | 1.5 | 13 | Every PR runs lint, typecheck, unit, build, and E2E. |
| 19 | Abuse and rate-limit hardening | 1.5 | 04, 06, 07 | Magic links, share creation, and owner commands are rate-limited with generic failures. |
| 20 | Privacy pack and retention | 1.5 | 08, 09 | A privacy page exists, old data is cleaned on a schedule, and processors are tracked. |
| 21 | Emergency controls and ops runbook | 1.5 | 06, 07, 08, 19 | Sharing and unlock commands can be stopped without taking the app down. |
| 22 | Per-locker activity and controls | 2 | 05, 06, 08, 10 | Locker detail shows its own recent activity, controls, and last sync. |
| 23 | PWA installability and offline fallback | 2 | 13, 14 | The app has a valid manifest, icons, and a safe offline page. |
| 24 | Web Share and QR code | 2 | 06, 12 | A created link can be shared through the OS or shown as a QR code. |
| 25 | Battery and gateway health warnings | 2 | 05, 08, 15 | Low battery and stale gateways are visible on the dashboard and detail page. |
| 26 | Pilot metrics report | 2 | 08, 09 | `pnpm metrics` reports the MVP success signals from the database. |
| 27 | Spanish localization | 3 | all UI tasks | Residents and guests can use the app in Spanish. |
| 28 | Session management and profile editing | 2 | 04, 09 | Residents can revoke other sessions and edit their display name. |
| 29 | Share lifecycle audit and link extension | 2 | 06, 08 | Share create/revoke/extend events are visible and live links can be extended safely. |
| 30 | Accessibility and security E2E coverage | 2 | 12, 14, 16, 17, 22 | Axe and the critical security paths run in the E2E suite. |

## Sequencing

- Tasks 16–21 are the pilot-critical set. Do them before inviting residents.
  Task 18 can start immediately because it only depends on the merged tooling.
- Tasks 22–24, 26, and 28–30 can run during the pilot, in the order that matches
  operator feedback. Task 25 lands after Task 15 has real gateway timestamps.
- Task 27 is Phase 3. Do not start it until the English pilot-critical and UX
  work is stable.
- Task 15 remains blocked on TTLock credentials and a test lock. Do not replace
  the mock provider for the pilot before Task 15 is complete.

## Open decisions left to the builder

- The exact CSP directive allowlist for Vercel Analytics and Next.js dev
  tooling; verify with the deployed build rather than guessing.
- Whether the one-minute cron fallback is fast enough for closed guest tabs, or
  whether the pilot should add a delayed job service. The design assumes the
  cron is acceptable for the first pilot.
- Whether owner unlocks should also auto-relock later. This design keeps owner
  unlocks manual so residents can load groceries without a countdown fight.
- The PWA icon artwork; reuse the existing lock mark with the correct safe area.
- The metrics report cadence and where the weekly output is stored.
