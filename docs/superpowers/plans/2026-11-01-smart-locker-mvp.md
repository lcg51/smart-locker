# Smart Locker MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the client-only Smart Locker demo into an invite-only, server-backed MVP where a resident signs in, confirms pre-provisioned lockers, unlocks them remotely, and shares expiring links that guests redeem without an account.

**Architecture:** Next.js App Router with server components and server actions; Postgres via Prisma; Auth.js magic-link sessions; a `LockProvider` adapter with a mock implementation for Phase 1 and a TTLock implementation behind it; share grants stored as SHA-256 hashes and redeemed server-side.

**Tech Stack:** Next.js 16.0.10, React 19.2, TypeScript 5 strict, Tailwind v4, shadcn/ui, Prisma + Postgres, Auth.js v5 + Resend, Upstash rate limiting, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-01-smart-locker-mvp-design.md`

## Global Constraints

- Pilot market is Spain. Hardware is CE-marked; data handling meets GDPR and LOPDGDD; Postgres runs in an EU region where available.
- Invite-only: sign-in is rejected unless the email exists in `AllowedEmail`.
- One resident per account. Ops pre-provisions users and lockers; residents never use a vendor app.
- Share defaults: 60 minutes, maximum 1440; `maxUses` default 5, maximum 50.
- Share tokens are 32 random bytes, returned once and stored only as a SHA-256 hash.
- Guest unlock is a server-side remote unlock. No per-guest vendor e-keys.
- Rate limits on redeem: 10 per minute per IP, 20 per minute per token.
- Sessions last 30 days.
- Email, not browser notifications, carries guest-unlock alerts.
- The PIN is a local convenience lock, never an authentication factor.
- Guest unlocks auto-relock after 30 seconds; owner unlocks are manual. The guest page shows the server-backed countdown.
- Account deletion hard-deletes the user, lockers, grants, events, sessions, accounts, and allowlist entry.
- Keep Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, and shadcn/ui.
- No native app. The guest page must work on iPhone Safari.
- The first pilot build uses English UI copy; Spanish is a follow-up.

## Review Focus

1. **Concurrent redemption of a `maxUses: 1` grant.** Two guests tap at once; exactly one unlock may happen and `usedCount` must end at 1. Pinned in Task 7.
2. **A revoked or expired link reopened.** It must fail closed with the same generic message as an unknown link. Pinned in Task 7.
3. **Cross-user locker access.** A resident requesting another resident's locker id must get "not found" and produce no event. Pinned in Task 5.
4. **Provider timeout or crash.** The UI must not claim success, and the event must record failure. Pinned in Tasks 5 and 15.
5. **Email provider failure during a guest unlock.** The unlock must still succeed. Pinned in Task 8.
6. **Wrong-theme flash on first load.** A device set to dark must not paint a light screen before the saved or system theme applies. Pinned in Task 14.

---

## Task Files

Work the tasks in order. Each file is self-contained: it lists its own files, interfaces, TDD steps, verification commands, and commit.

| # | Task | Phase | Depends on |
|---|------|-------|------------|
| 01 | [Tooling, environment validation, and test harness](2026-11-01-smart-locker-mvp/task-01-tooling-env-test-harness.md) | Phase 1 | — |
| 02 | [Prisma schema, migration, and ops provisioning](2026-11-01-smart-locker-mvp/task-02-prisma-schema-provisioning.md) | Phase 1 | Task 01 |
| 03 | [Lock provider interface, mock provider, and factory](2026-11-01-smart-locker-mvp/task-03-lock-provider-mock.md) | Phase 1 | Task 01 |
| 04 | [Auth.js magic-link sign-in with an invite allowlist](2026-11-01-smart-locker-mvp/task-04-magic-link-auth.md) | Phase 1 | Task 01, Task 02 |
| 05 | [Locker queries, unlock/lock service, and dashboard](2026-11-01-smart-locker-mvp/task-05-locker-service-dashboard.md) | Phase 1 | Task 02, Task 03, Task 04 |
| 06 | [Share grant creation, revocation, and owner UI](2026-11-01-smart-locker-mvp/task-06-share-grants-owner-ui.md) | Phase 1 | Task 02, Task 05 |
| 07 | [Public share page, atomic redemption, and rate limiting](2026-11-01-smart-locker-mvp/task-07-guest-redemption.md) | Phase 1 | Task 02, Task 03, Task 06 |
| 08 | [Activity log and guest-unlock email](2026-11-01-smart-locker-mvp/task-08-activity-log-email.md) | Phase 1 | Task 02, Task 07 |
| 09 | [Settings and account deletion](2026-11-01-smart-locker-mvp/task-09-settings-account-deletion.md) | Phase 1 | Task 04, Task 06, Task 07, Task 08 |
| 10 | [Onboarding, rename, and confirmation](2026-11-01-smart-locker-mvp/task-10-onboarding-confirmation.md) | Phase 1 | Task 02, Task 05 |
| 11 | [Optional local PIN app lock](2026-11-01-smart-locker-mvp/task-11-local-pin-lock.md) | Phase 1 | Task 05, Task 09 |
| 12 | [End-to-end share flow and test session route](2026-11-01-smart-locker-mvp/task-12-e2e-share-flow.md) | Phase 1 | Task 04, Task 05, Task 06, Task 07, Task 10 |
| 13 | [Legacy cleanup, typecheck, lint, and README](2026-11-01-smart-locker-mvp/task-13-legacy-cleanup-readme.md) | Phase 1 | Task 01, Task 02, Task 03, Task 04, Task 05, Task 06, Task 07, Task 08, Task 09, Task 10, Task 11, Task 12 |
| 14 | [Light, dark, and system appearance](2026-11-01-smart-locker-mvp/task-14-dark-mode.md) | Phase 1.5 | Task 13 |
| 15 | [TTLock provider and credential encryption (Phase 2)](2026-11-01-smart-locker-mvp/task-15-ttlock-provider.md) | Phase 2 | Task 01, Task 02, Task 03 |

### Pilot hardening and growth backlog (Tasks 16–38)

The [pilot hardening and growth design](../specs/2026-11-03-smart-locker-pilot-hardening-design.md)
is the spec of record for these tasks. Tasks 16–21 are the pilot-critical set;
do not invite residents before they pass. Task 15 remains the blocked TTLock
provider task and does not move earlier.

| # | Task | Phase | Depends on |
|---|------|-------|------------|
| 16 | [Guest unlock auto-relock](2026-11-01-smart-locker-mvp/task-16-guest-auto-relock.md) | Phase 1.5 | Task 03, Task 07, Task 08, Task 12 |
| 17 | [Guest-link privacy and security headers](2026-11-01-smart-locker-mvp/task-17-guest-link-privacy-headers.md) | Phase 1.5 | Task 07, Task 12, Task 14 |
| 18 | [CI quality gate](2026-11-01-smart-locker-mvp/task-18-ci-quality-gate.md) | Phase 1.5 | Task 13 |
| 19 | [Abuse and rate-limit hardening](2026-11-01-smart-locker-mvp/task-19-abuse-rate-limits.md) | Phase 1.5 | Task 04, Task 06, Task 07 |
| 20 | [Privacy pack and retention](2026-11-01-smart-locker-mvp/task-20-privacy-retention.md) | Phase 1.5 | Task 08, Task 09 |
| 21 | [Emergency controls and ops runbook](2026-11-01-smart-locker-mvp/task-21-emergency-controls.md) | Phase 1.5 | Task 06, Task 07, Task 08, Task 19 |
| 22 | [Per-locker activity and controls](2026-11-01-smart-locker-mvp/task-22-locker-detail-activity.md) | Phase 2 | Task 05, Task 06, Task 08, Task 10 |
| 23 | [PWA installability and offline fallback](2026-11-01-smart-locker-mvp/task-23-pwa-installability.md) | Phase 2 | Task 13, Task 14 |
| 24 | [Web Share and QR code](2026-11-01-smart-locker-mvp/task-24-share-qr.md) | Phase 2 | Task 06, Task 12 |
| 25 | [Battery and gateway health warnings](2026-11-01-smart-locker-mvp/task-25-health-warnings.md) | Phase 2 | Task 05, Task 08, Task 15 |
| 26 | [Pilot metrics report](2026-11-01-smart-locker-mvp/task-26-pilot-metrics.md) | Phase 2 | Task 08, Task 09 |
| 27 | [Spanish localization](2026-11-01-smart-locker-mvp/task-27-spanish-localization.md) | Phase 3 | all UI tasks |
| 28 | [Session management and profile editing](2026-11-01-smart-locker-mvp/task-28-session-management.md) | Phase 2 | Task 04, Task 09 |
| 29 | [Share lifecycle audit and link extension](2026-11-01-smart-locker-mvp/task-29-share-lifecycle.md) | Phase 2 | Task 06, Task 08 |
| 30 | [Accessibility and security E2E coverage](2026-11-01-smart-locker-mvp/task-30-accessibility-security-e2e.md) | Phase 2 | Task 12, Task 14, Task 16, Task 17, Task 22 |
| 31 | [Form success toast notifications](2026-11-01-smart-locker-mvp/task-31-form-success-toasts.md) | Phase 2 | Task 05, Task 06, Task 08, Task 09, Task 10, Task 22, Task 28, Task 29 |
| 32 | [TTLock API quota reduction and guard](2026-11-01-smart-locker-mvp/task-32-ttlock-api-quota.md) | Phase 2.5 | Task 15, Task 16 |
| 33 | [Evaluate local Bluetooth control](2026-11-01-smart-locker-mvp/task-33-local-bluetooth-evaluation.md) | Phase 3 (evaluation) | Task 32 |
| 34 | [Evaluate TTLock on-premise](2026-11-01-smart-locker-mvp/task-34-on-premise-evaluation.md) | Phase 3 (evaluation) | Task 32 |
| 35 | [Spanish UI finishing pass](2026-11-01-smart-locker-mvp/task-35-spanish-ui-finishing.md) | Phase 3 | Task 27 |
| 36 | [Localized sign-in email](2026-11-01-smart-locker-mvp/task-36-localized-sign-in-email.md) | Phase 3 | Task 04, Task 27 |
| 37 | [Empty-state guidance for residents without lockers](2026-11-01-smart-locker-mvp/task-37-empty-lockers-guidance.md) | Phase 2 | Task 05, Task 10, Task 27 |
| 38 | [Relock scheduler runbook and verification](2026-11-01-smart-locker-mvp/task-38-relock-scheduler.md) | Phase 1.5 (ops) | Task 16, Task 21 |

**Task 33 status:** evaluated 2026-11-21. Proposed no-go for the pilot; the free tier is 30,000 calls per month per application, and local Bluetooth drops the guest link, server relock, and history. Decision pending owner sign-off: [ttlock-local-bluetooth.md](../../decisions/ttlock-local-bluetooth.md).

**Task 34 status:** evaluated 2026-11-21. Proposed no-go for the pilot; the TTLock licence has no public price, the on-premise stack is not a drop-in replacement, and the cloud free tier covers a pilot. Decision pending a TTLock quote and owner sign-off: [ttlock-on-premise.md](../../decisions/ttlock-on-premise.md).

**Backlog Review Focus**

1. **A guest closes the tab before the 30-second timer.** The locker must still
   relock through the cron sweeper, and a reload must not offer another unlock
   while `relockAt` is in the future. Pinned in Task 16.
2. **A restrictive CSP breaks the app.** Every surface must load with no CSP
   console errors, and the share page must keep `frame-ancestors 'none'`.
   Pinned in Task 17.
3. **Retention deletes live data.** Only inactive grants, expired sessions and
   tokens, and old lock events may be removed; a live grant and a recent event
   must survive. Pinned in Task 20.
4. **A kill switch blocks the safe direction.** With sharing or unlock commands
   disabled, revoking and locking must still work. Pinned in Task 21.
5. **Spanish copy is missing on a surface.** Every dictionary key must exist in
   both languages, and the guest page must follow `Accept-Language` with no
   language control. Pinned in Task 27.
6. **A success toast hides a validation error or is lost on navigation.** Errors
   must stay inline, instructional text must stay visible, and redirect-only
   actions must not pretend a toast will survive. Pinned in Task 31.
7. **The quota guard blocks a safety action.** When state reads are paused, an
   owner unlock, a guest unlock, or a relock must still work below the hard
   limit, and a blocked call must never silently claim success. Pinned in
   Task 32.
8. **A missing page or sign-in email falls back to English.** Both must follow
   the requester's language without revealing invite status. Pinned in Tasks 35
   and 36.
9. **A resident with no lockers is stuck.** The dashboard must explain that the
   building administrator assigns lockers and offer a recheck. Pinned in
   Task 37.
10. **A guest closes the tab and the locker never relocks.** On Vercel Hobby the
    minute fallback needs an external scheduler; the measured relock latency
    must be recorded. Pinned in Task 38.

## Dependency order

```text
Task 01 -> Task 02 -> Task 04 -> Task 05 -> Task 06 -> Task 07 -> Task 08 -> Task 09
Task 01 -> Task 03 -> Task 05
Task 02 -> Task 05 -> Task 10 -> Task 12
Task 05 -> Task 11 (also needs Task 09)
Tasks 01-12 -> Task 13 -> Task 14 (appearance, before the pilot invite)
Tasks 01-03 -> Task 15 (Phase 2; also gated on vendor credentials; runs after Task 14)
Tasks 01-14 -> Tasks 16-21 (pilot-critical; before inviting residents)
Task 18 can start as soon as Task 13 is merged
Task 05, 06, 08, 10 -> Task 22
Task 13, 14 -> Task 23
Task 06, 12 -> Task 24
Task 05, 08, 15 -> Task 25
Task 08, 09 -> Task 26
All UI tasks -> Task 27 (Phase 3)
Task 04, 09 -> Task 28
Task 06, 08 -> Task 29
Task 12, 14, 16, 17, 22 -> Task 30
Task 05, 06, 08, 09, 10, 22, 28, 29 -> Task 31
Task 15, 16 -> Task 32
Task 32 -> Tasks 33, 34 (evaluations; no code until a go decision)
Task 27 -> Task 35
Task 04, 27 -> Task 36
Task 05, 10, 27 -> Task 37
Task 16, 21 -> Task 38 (ops; runs in parallel with 35–37)
```

Tasks 02, 03, and 10 can run in parallel once Task 01 lands. Tasks 06 and 10 can run in parallel once Task 05 lands. Everything else is sequential because it consumes the previous task's interfaces. Tasks 22–24, 26, 28–32, and 35–37 can run during the pilot; Task 25 waits for Task 15's real gateway timestamps; Task 27 is complete. Tasks 33 and 34 are decision gates and can run in parallel after Task 32. Task 38 is operations and can run alongside the remaining polish.

## Execution notes

- Load `superpowers:test-driven-development` before Task 01. Every step is already ordered RED then GREEN.
- One task per branch or worktree is fine; each task ends in a commit. If splitting work across people, respect the dependency column above.
- Complete Task 14 (appearance) before inviting pilot residents.
- Complete Tasks 16–21 before inviting pilot residents. Task 16 fixes a false auto-relock promise; do not treat it as optional polish.
- Phase 1 ships on `MockLockProvider`; do not start Task 15 until a TTLock developer account and a test lock exist.
- Task 25 can land with null-safe mock data, but recheck it after Task 15 sets real `gatewayLastSeenAt` values.
- Run Task 31 after Task 29 so the share-extension dialog exists; keep validation and failure messages inline.
- Confirm the TTLock monthly quota on the developer console before Task 32; the guard's thresholds depend on it.
- Tasks 33 and 34 produce decision documents only. Do not start their code until the owner records a go.
- Tasks 35–37 are finishing work after Task 27; Task 37 is the support path for an unprovisioned resident.
- Complete Task 38 before inviting residents: without the external minute scheduler, a guest who closes the tab never relocks on Vercel Hobby.
- Task 35 must update the existing 404 assertion in the security E2E when it replaces Next's default page.
- Run each task's final verification command and read its output before claiming the task complete.
