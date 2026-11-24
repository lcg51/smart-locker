# Smart Locker

Smart Locker is an invite-only web app for residents of a Spain pilot building. A resident signs in with a magic link, confirms the lockers installed in their apartment, unlocks them remotely, and shares temporary guest access through an expiring link. Guests need no account and no app.

The MVP runs on a mock lock provider so the product flow can be built and tested before physical hardware is connected. The TTLock provider and credential encryption are Phase 2 work.

## What is in the MVP

- Email magic-link sign-in with an invite allowlist.
- Pre-provisioned apartment lockers with confirmation, renaming, and battery/status display.
- Remote lock/unlock through a server-side `LockProvider`.
- Expiring, use-limited share links that guests redeem without signing in.
- OS share sheet and browser-generated QR code for guest links; the QR never leaves the browser or reaches analytics.
- Share-link lifecycle history and safe extension of live links, capped at 24 hours and 50 unlocks.
- Successful settings and form actions confirm with a toast; validation and failure messages stay inline.
- Guest unlocks relock automatically after 30 seconds; owner unlocks stay manual.
- Owner activity history and optional guest-unlock email notifications.
- Account settings, guest-email preference, display-name editing, active-session review with device and approximate location, and hard account deletion.
- Public privacy notice at `/privacy` and scheduled data retention.
- Installable PWA with an offline fallback; unlocking still requires a connection.
- Light, dark, or system appearance, defaulting to the device preference and chosen in Settings.
- English and Spanish UI. Residents choose the language in Settings → Language; guests follow their browser's `Accept-Language` and have no language picker. Guest-unlock email uses the owner's chosen language.
- Optional local device PIN as a convenience lock; it is not authentication.
- End-to-end share-flow coverage with Playwright.
- Security and accessibility E2E coverage: bearer-link failure modes, cross-resident access, guest-page disclosure and headers, axe checks on key pages, and keyboard and focus behavior.

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

`e2e/security.spec.ts` covers expired, revoked, and one-use links, cross-resident 404s, guest-page disclosure, and headers. `e2e/accessibility.spec.ts` runs axe (`@axe-core/playwright`) on the sign-in, dashboard, settings, activity, and guest pages, and checks theme radios and share-dialog focus. The `beto@example.com` resident exists only in the test seed.

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
| `CRON_SECRET` | Optional bearer secret for the relock and cleanup cron endpoints; required in production for both scheduled jobs. |
| `SHARING_ENABLED` | Set `false` to block creating and redeeming share links while keeping revoke and lock available; defaults to `true`. |
| `LOCK_COMMANDS_ENABLED` | Set `false` to block unlocks while keeping locks available; defaults to `true`. |
| `E2E` | Set only in the test environment; enables `/api/test/session`. |

If Upstash is not configured, redemption uses an in-memory limiter, which is suitable for a single app instance only.

The ops scripts (`pnpm provision`, `pnpm bulk-revoke`, and `pnpm metrics`) load `.env.local` first and then `.env`; `.env.local` takes precedence. Next.js follows the same local-first convention.

Guest unlocks set a server-side `relockAt` deadline. The guest page counts down to that deadline and calls the relock action when it reaches zero; the page reports the server result and never claims a relock it did not confirm. `/api/cron/relock` is a one-minute fallback for guests who close the tab before the timer fires. It requires `CRON_SECRET` and a scheduler. `vercel.json` schedules only the daily cleanup cron because Vercel Hobby rejects crons that run more than once a day; on Hobby, call `/api/cron/relock` from an external scheduler every minute and document the achieved interval. Add the one-minute cron back to `vercel.json` on Pro.

Retention is enforced by `/api/cron/cleanup` (daily at 03:00 UTC, also protected by `CRON_SECRET`): inactive share links and expired sessions/verification tokens are removed 30 days after they stop being usable, and lock events after 12 months. The public privacy notice is at `/privacy`; set `PRIVACY_CONTACT_EMAIL` to the monitored contact before inviting residents.

### Emergency controls

- `SHARING_ENABLED=false` blocks creating and redeeming share links. Revoking links, owner lock/unlock, and guest relock stay available.
- `LOCK_COMMANDS_ENABLED=false` blocks owner and guest unlocks. Locking stays available.
- `pnpm bulk-revoke --email resident@example.com --yes` revokes that resident's live links; `pnpm bulk-revoke --all --yes` revokes every live link. The command refuses to run without `--yes` and requires exactly one target. Point `DATABASE_URL` at the intended database first.
- These are deploy-time environment changes. A running process must be restarted or redeployed before a switch takes effect.

### Pilot metrics

`pnpm metrics --from YYYY-MM-DD --to YYYY-MM-DD` prints a read-only Markdown and JSON report of pilot activity. The default window is the last 28 days. See `docs/pilot-metrics.md` for definitions, zero-denominator guidance, and the MVP success signals.

## Staging deployment on Vercel Hobby

This is the staging setup for the mock provider on the free Vercel plan. It is
for checking the deployment, email, database, and guest flow. Do not invite
residents on it.

**Prerequisites:** an EU Postgres database (Neon or Supabase), a Resend account,
a Vercel project connected to the GitHub repo, and the `dev` branch on GitHub.

### 1. Create the staging database

Create a Neon or Supabase project in an EU region. Keep two connection strings:

- **Pooled**, for Vercel at runtime.
- **Direct**, for migrations from your machine.

Apply the schema with the direct URL, from the repo root:

```bash
DATABASE_URL='postgresql://...direct...' pnpm db:deploy
```

Only `db:deploy` runs on a hosted database. Never use `prisma migrate reset` or
`prisma migrate dev` there. Keep your local `.env.local` pointed at your local
database; the inline value applies to that one command.

### 2. Configure Vercel

Set the project's **Production Branch** to `dev` under **Settings →
Environments → Production → Branch Tracking**. `vercel.json` also sets
`git.deploymentEnabled` to `{"**": false, "dev": true}`, so only `dev` deploys;
pull requests and other branches do not create preview deployments. GitHub
Actions still runs the CI gate on every PR. Remove that rule if you want Vercel
previews again.

Then add these variables for Production:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Pooled connection string; append `&connection_limit=1` so serverless instances do not exhaust connections. |
| `AUTH_SECRET` | Random value, at least 32 characters. |
| `AUTH_URL` | Deployment URL, including `https://`. |
| `APP_URL` | Same deployment URL. |
| `EMAIL_FROM` | A bare address on a domain verified in Resend. |
| `RESEND_API_KEY` | Resend key with sending access. |
| `PRIVACY_CONTACT_EMAIL` | A monitored address. |
| `CRON_SECRET` | Random value, at least 16 characters. |
| `LOCK_PROVIDER` | `mock`. |

Leave `E2E` unset; it enables the test-session route. `UPSTASH_*` is optional
while staging runs a single instance. Redeploy after changing variables; Vercel
does not apply them to an existing deployment.

### 3. Resend

Verify the sending domain and set `EMAIL_FROM` to an address on it. With
`onboarding@resend.dev`, Resend delivers only to the address that owns the Resend
account, so a magic link to any other tester will not arrive.

### 4. Provision the first resident

Sign-in is invite-only. The allowlist check reads the `AllowedEmail` table, so a
fresh database rejects every address with `AccessDenied` until a resident is
provisioned. The provision script creates the allowlist entry, the user, and the
lockers in one transaction:

```bash
DATABASE_URL='postgresql://...direct...' pnpm provision \
  --email you@example.com \
  --gateway gw-staging \
  --locker "Kitchen:mock:staging-lock-1"
```

The `--locker` value is `name:vendor:vendorLockId`. With `LOCK_PROVIDER=mock`,
the lock ID is any unique string. Use a different `vendorLockId` per resident:
provisioning matches on `(vendor, vendorLockId)` and does not move an existing
locker to a new user.

### 5. Cron limits

Vercel Hobby allows cron jobs only once per day, so `vercel.json` schedules just
`/api/cron/cleanup`. A guest who keeps the tab open still relocks, because the
page calls the relock action at the deadline. Closed tabs need
`/api/cron/relock` called every minute from an external scheduler with
`Authorization: Bearer <CRON_SECRET>`. Add the one-minute cron back to
`vercel.json` on Pro.

### 6. First-run check

1. Open `/auth`, request a magic link, and sign in.
2. Confirm the dashboard shows the provisioned locker and `/onboarding` asks you
   to confirm it.
3. Create a guest link and open it in a private window.
4. Confirm `/privacy` renders with the configured contact.
5. Confirm a second, unprovisioned address is refused at sign-in.

### Troubleshooting

| Symptom | Cause |
|---|---|
| `ZodError` for an env key | A required variable is missing, or `APP_URL`/`AUTH_URL` lacks `https://`. Check the `issues` array for the key and redeploy. |
| `AccessDenied` at sign-in | The address has no `AllowedEmail` row in the database the app uses. Provision it. |
| Dashboard says "No lockers yet" | The locker is missing or belongs to another user. Check `select id, email from "User"` and the locker's `userId`; reassign it or delete it and re-provision with a unique `vendorLockId`. After provisioning, ask the resident to press **Check again**; no sign-out is needed. |
| Magic link never arrives | `EMAIL_FROM` is not on a verified domain, or you use `onboarding@resend.dev` with a recipient other than the Resend account owner. |
| Tables missing in the Neon console | You are viewing a different branch or database. Run the information_schema query on the branch in `DATABASE_URL`. |

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
- **No offline unlocking.** The service worker caches only static assets and `/offline`. It never caches `/dashboard`, `/share/*`, `/auth`, `/onboarding`, or `/api/*`, and unlocking always requires a network connection.

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

This is the first phase of the MVP: Spain pilot, English and Spanish UI, mock lock provider, and no native app. Real TTLock integration, push notifications, and building-wide management are follow-up work.
