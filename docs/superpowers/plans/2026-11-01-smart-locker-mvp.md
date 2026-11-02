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
- The lock auto-relocks after 30 seconds; the guest page shows that countdown.
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

## Dependency order

```text
Task 01 -> Task 02 -> Task 04 -> Task 05 -> Task 06 -> Task 07 -> Task 08 -> Task 09
Task 01 -> Task 03 -> Task 05
Task 02 -> Task 05 -> Task 10 -> Task 12
Task 05 -> Task 11 (also needs Task 09)
Tasks 01-12 -> Task 13 -> Task 14 (appearance, before the pilot invite)
Tasks 01-03 -> Task 15 (Phase 2; also gated on vendor credentials; runs after Task 14)
```

Tasks 02, 03, and 10 can run in parallel once Task 01 lands. Tasks 06 and 10 can run in parallel once Task 05 lands. Everything else is sequential because it consumes the previous task's interfaces.

## Execution notes

- Load `superpowers:test-driven-development` before Task 01. Every step is already ordered RED then GREEN.
- One task per branch or worktree is fine; each task ends in a commit. If splitting work across people, respect the dependency column above.
- Complete Task 14 (appearance) before inviting pilot residents.
- Phase 1 ships on `MockLockProvider`; do not start Task 15 until a TTLock developer account and a test lock exist.
- Run each task's final verification command and read its output before claiming the task complete.
