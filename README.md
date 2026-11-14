# Smart Locker

Smart Locker is an invite-only web app for residents of a Spain pilot building. A resident signs in with a magic link, confirms the lockers installed in their apartment, unlocks them remotely, and shares temporary guest access through an expiring link. Guests need no account and no app.

The MVP runs on a mock lock provider so the product flow can be built and tested before physical hardware is connected. The TTLock provider and credential encryption are Phase 2 work.

## What is in the MVP

- Email magic-link sign-in with an invite allowlist.
- Pre-provisioned apartment lockers with confirmation, renaming, and battery/status display.
- Remote lock/unlock through a server-side `LockProvider`.
- Expiring, use-limited share links that guests redeem without signing in.
- Guest unlocks relock automatically after 30 seconds; owner unlocks stay manual.
- Owner activity history and optional guest-unlock email notifications.
- Account settings, guest-email preference, and hard account deletion.
- Public privacy notice at `/privacy` and scheduled data retention.
- Light, dark, or system appearance, defaulting to the device preference and chosen in Settings.
- Optional local device PIN as a convenience lock; it is not authentication.
- End-to-end share-flow coverage with Playwright.

## Prerequisites

- Node.js 22 or newer.
- pnpm (the committed lockfile is the source of dependency truth).
- Docker Desktop or another Docker runtime for local PostgreSQL.
- A Resend API key for real magic-link and guest-unlock email delivery.

## Local setup

```bash
cp .env.example .env
docker compose up -d db
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev
```

Open <http://localhost:3000>. `docker compose` starts PostgreSQL 16 on `localhost:5432` and creates the development database.

### Email locally

Set `RESEND_API_KEY` and `EMAIL_FROM` in `.env`. `EMAIL_FROM` must be a bare address on a domain verified in Resend. For a quick Resend test, `onboarding@resend.dev` works only when the recipient is the email address associated with the Resend account. Without working email, sign-in cannot complete.

### Provision a resident and lockers

Ops creates the resident, allowlist entry, and locker rows together:

```bash
pnpm provision \
  --email resident@example.com \
  --gateway gw-001 \
  --locker "Kitchen:mock:local-lock-kitchen" \
  --locker "Hallway:mock:local-lock-hall"
```

Each `--locker` uses `name:vendor:vendorLockId`. The command is idempotent by email and vendor lock ID. The resident signs in, confirms the lockers on `/onboarding`, and can then use the dashboard.

For the mock provider, the `vendorLockId` is any stable string. Lock state is simulated by the server process.

### Test and verification

Unit and integration tests use a separate test database:

```bash
cp .env.test.example .env.test
pnpm test:db
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

End-to-end tests start their own app server on port **3100** and reset the **test** database:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

The E2E suite requires port 3100 to be free. It seeds `ana@example.com` with a `Kitchen` locker, confirms onboarding, unlocks, creates a share link, redeems it as a guest, and verifies revocation fails closed. Guest-unlock email is disabled for the seeded resident so tests do not call Resend.

**Test database safety:** both `pnpm test` and `pnpm test:e2e` delete data. `pnpm test` clears every application table between tests, and the E2E setup runs `prisma migrate reset`. Exported environment variables take precedence over `.env.test`, so a shell-exported `DATABASE_URL` can silently redirect those destructive operations. Run tests in a shell with no non-test `DATABASE_URL` exported. As a guard, the test helpers and E2E setup refuse to proceed unless the database name ends with `_test`.

### CI

Every pull request and every push to `dev` runs `.github/workflows/ci.yml`:

- `verify` installs with `pnpm install --frozen-lockfile`, migrates the test database, and runs `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- `e2e` provisions the same test database, installs Chromium, and runs `pnpm test:e2e`.

CI pins Node 22 (`.nvmrc`) and pnpm 12.16.1 (`packageManager`). Both jobs run PostgreSQL 16 against `smart_locker_test`. Never add a pilot database URL to the workflow.

## Configuration

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. |
| `AUTH_SECRET` | Auth.js secret; at least 32 characters. |
| `AUTH_URL` | Auth.js base URL. |
| `APP_URL` | Public app URL used to build share links. |
| `EMAIL_FROM` | Verified Resend sender address. |
| `RESEND_API_KEY` | Resend API key. |
| `PRIVACY_CONTACT_EMAIL` | Monitored contact address shown in the privacy notice; required. |
| `LOCK_PROVIDER` | `mock` (default) or `ttlock`. |
| `TTLOCK_API_BASE` | TTLock API base URL, Phase 2. |
| `TTLOCK_ACCESS_TOKEN` | TTLock access token, Phase 2. |
| `CREDENTIAL_ENCRYPTION_KEY` | 64 hex characters for vendor credential encryption, Phase 2. |
| `UPSTASH_REDIS_REST_URL` | Optional; enables distributed rate limiting for sign-in, shares, and lock commands. |
| `UPSTASH_REDIS_REST_TOKEN` | Optional; required with the Upstash URL. |
| `RELOCK_SECONDS` | Guest relock delay in seconds; defaults to `30`. |
| `CRON_SECRET` | Optional bearer secret for the relock cron endpoint; required in production for the fallback sweep. |
| `E2E` | Set only in the test environment; enables `/api/test/session`. |

If Upstash is not configured, redemption uses an in-memory limiter, which is suitable for a single app instance only.

Guest unlocks set a server-side `relockAt` deadline. The guest page counts down to that deadline and calls the relock action when it reaches zero; the page reports the server result and never claims a relock it did not confirm. `/api/cron/relock` is a one-minute fallback for guests who close the tab before the timer fires. It requires `CRON_SECRET` and the Vercel cron configured in `vercel.json`; on plans that do not allow one-minute crons, schedule the same endpoint externally and document the achieved interval.

Retention is enforced by `/api/cron/cleanup` (daily at 03:00 UTC, also protected by `CRON_SECRET`): inactive share links and expired sessions/verification tokens are removed 30 days after they stop being usable, and lock events after 12 months. The public privacy notice is at `/privacy`; set `PRIVACY_CONTACT_EMAIL` to the monitored contact before inviting residents.

## Mock and TTLock providers

`LOCK_PROVIDER=mock` is the Phase 1 default. It supports provisioning, lock, unlock, and state reads without hardware, and auto-registers unknown lock IDs so seeded fixtures work.

`LOCK_PROVIDER=ttlock` is scaffolded for Phase 2. Do not enable it for the pilot until the TTLock developer account, gateway, test lock, credential encryption, and provider tests from Task 15 are complete. Until then, keep `LOCK_PROVIDER=mock`.

## Security and privacy model

- **Invite-only.** Sign-in is rejected unless the email is in `AllowedEmail`. There is no public sign-up.
- **No passwords.** Auth.js magic links establish a database session; sessions last 30 days and are revoked on sign-out and account deletion.
- **Guest links are bearer credentials.** Tokens are 32 random bytes, returned once, and stored only as SHA-256 hashes. Treat a link like a key.
- **Expiry and use limits.** Links default to 60 minutes and 5 uses, with caps of 24 hours and 50 uses. Redemption is atomic across concurrent guests.
- **Fail closed.** Expired, revoked, exhausted, and unknown links show the same generic unavailable page.
- **Rate limiting.** Magic-link requests are limited to 5 per 10 minutes per normalized email and 20 per 10 minutes per client IP. Share creation is limited to 10 per hour per resident and 20 active grants per locker. Owner lock/unlock commands are limited to 30 per minute per resident. Guest redemption is limited to 10 per minute per IP and 20 per minute per token.
- **Minimal guest disclosure.** Guest pages show the locker display name, owner-provided guest label, and expiry; never the owner's email, gateway ID, vendor lock ID, or other lockers.
- **Device PIN is not security.** The optional 4-digit PIN is a local convenience lock stored as a salted PBKDF2 hash in that browser. It is not sent to the server, does not authenticate the account, and is cleared on sign-out.
- **Data handling.** The pilot targets Spain and EU hosting where available. The intent is GDPR/LOPDGDD compliance. The privacy notice at `/privacy` describes the processing and rights; inactive share links, expired sessions/tokens, and old lock events are removed on the retention schedule. Account deletion hard-deletes the user, lockers, grants, events, sessions, provider accounts, verification tokens, and allowlist entry. The MVP keeps no anonymised audit trail after deletion.
- **No sensitive data in URLs beyond the share token.** Share pages send `Referrer-Policy: no-referrer`, and analytics pageviews are suppressed on `/share/*`.
- **Security headers.** Every response sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, a restrictive `Content-Security-Policy` with `frame-ancestors 'none'`, and a minimal `Permissions-Policy`. Share pages add `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow, noarchive`, and `Referrer-Policy: no-referrer`; `/dashboard`, `/auth`, and `/onboarding` add `no-store` and `noindex`. The CSP allows inline scripts because Next.js needs them for bootstrap; a nonce-based policy is post-MVP.

## Project layout

| Path | Purpose |
|---|---|
| `app/` | Next.js App Router routes, pages, server actions, and the test-session route. |
| `components/` | Resident and guest UI components. |
| `lib/auth/` | Auth.js configuration helpers and the invite allowlist. |
| `lib/lockers/` | Owner-scoped locker queries, commands, and onboarding operations. |
| `lib/locks/` | `LockProvider` contract, mock provider, and factory. |
| `lib/shares/` | Token creation, hashing, redemption, and owner listing. |
| `lib/rate-limit.ts` | Upstash or in-memory redemption limiter. |
| `lib/account/delete.ts` | Hard account deletion. |
| `prisma/` | Schema and migrations. |
| `scripts/` | Ops provisioning entry points. |
| `tests/` | Vitest unit and integration tests. |
| `e2e/` | Playwright share-flow tests and deterministic seed. |
| `docs/pilot-setup-guide.md` | Operator checklist for the Spain pilot. |

## Pilot scope

This is the first phase of the MVP: English UI copy, Spain pilot, mock lock provider, and no native app. Spanish copy, real TTLock integration, push notifications, and building-wide management are follow-up work.
