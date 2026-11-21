# Pilot Setup Guide

This guide is for the operator running the first Smart Locker pilot in Spain. It covers hardware, vendor credentials, deployment, resident provisioning, and acceptance checks.

Commands that touch the pilot database require `DATABASE_URL` to point at that database. Exported environment variables override values in `.env`, so confirm the target before running migrations or provisioning.

## 1. Hardware

- Procure CE-marked locker locks compatible with the chosen vendor, plus one vendor gateway per apartment.
- Confirm the locks use the vendor's remote unlock API and do not require a resident-facing vendor account.
- Buy a small pilot batch first; confirm range, power, and gateway behavior in the actual apartment.
- Record each lock's vendor ID and the gateway's vendor ID before provisioning. These values are required in the `Locker` rows and `User.vendorGatewayId`.
- Check that the gateway runs on the apartment's 2.4 GHz Wi-Fi and has mains power. It is the single point of failure for remote unlock.

## 2. Vendor credentials

- Create the lock vendor's developer account and obtain API credentials.
- Phase 1 uses `LOCK_PROVIDER=mock`; do not point the pilot at real hardware until Phase 2 is complete.
- When Task 15 lands, run:

```bash
pnpm tsx scripts/seed-vendor-credential.ts
```

with `TTLOCK_ACCESS_TOKEN` and `CREDENTIAL_ENCRYPTION_KEY` set. The script does not exist in Phase 1; until it does, keep `LOCK_PROVIDER=mock`.

## 3. Deploy and migrate

- Use PostgreSQL in an EU region where available. Confirm the provider's region and backup policy.
- Point `DATABASE_URL` at the pilot database.
- Run `pnpm db:deploy` against that database. The schema must exist before provisioning. Do not use `prisma migrate reset` outside the test environment.
- Set production values for `APP_URL`, `AUTH_SECRET`, `EMAIL_FROM`, `RESEND_API_KEY`, and `PRIVACY_CONTACT_EMAIL`.
- Verify the Resend sending domain and add the required DNS records before inviting residents.
- Replace `PRIVACY_CONTACT_EMAIL` with the monitored pilot contact address, have counsel review `/privacy` and `docs/privacy/processor-region-checklist.md`, and complete every `TODO` in that checklist before inviting residents.
- Configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` if the app runs more than one instance. Without Upstash, limits are per process and each instance gets its own quota.
- Set `CRON_SECRET` to a random value of at least 16 characters and keep it in the deployment's secret store. The relock fallback returns `503` until it is set.
- Before inviting residents, confirm `/api/cron/relock` runs at least every minute. The Hobby plan cannot schedule it: `vercel.json` on the staging branch ships only the daily cleanup cron, because Hobby rejects any cron that runs more than once a day. The staging deployment still relocks while the guest tab is open, because the page calls the relock action at the deadline. Closed tabs need the fallback. On Hobby, call `/api/cron/relock` from an external scheduler every minute with the `CRON_SECRET` bearer token, record the achieved interval in the pilot log, and accept that the fallback runs later than a Pro deployment would. Move the relock cron back into `vercel.json` when the project is on Pro.
- Confirm `/api/cron/cleanup` is scheduled daily at 03:00 UTC (`vercel.json`) and has run once. It deletes inactive share links and expired sessions/verification tokens 30 days after they stop being usable, and lock events after 12 months. It also requires `CRON_SECRET`.
- Put a trusted proxy in front of the app so the first `x-forwarded-for` entry is the real client IP. Magic-link and guest-redemption limits key on that value.
- Rate limits: magic links 5 per 10 minutes per email and 20 per 10 minutes per IP; share creation 10 per hour per resident and 20 active links per locker; owner commands 30 per minute per resident; guest redemption 10 per minute per IP and 20 per minute per token.
- Keep `LOCK_PROVIDER=mock` until hardware and Task 15 are ready.
- Treat the CI gate as required before merging to `dev`: every PR runs lint, typecheck, unit tests, build, and E2E. The `e2e` job uses only the `smart_locker_test` database and must never receive a pilot `DATABASE_URL`.
- Before inviting residents, confirm the latest `dev` passes `pnpm test:e2e e2e/security.spec.ts e2e/accessibility.spec.ts` against the test database. These specs cover expired, revoked, and one-use links, cross-resident 404s, guest-page disclosure and headers, and serious or critical axe violations. Confirm `beto@example.com` exists only in the test seed (`e2e/global-setup.ts`) and never in the pilot database.

## 4. Provision an apartment

With `DATABASE_URL` still pointing at the migrated pilot database, run:

```bash
pnpm provision \
  --email resident@example.com \
  --gateway gw-001 \
  --locker "Kitchen:ttlock:12345" \
  --locker "Hallway:ttlock:12346"
```

Each locker uses `name:vendor:vendorLockId`. The command:

- adds the email to `AllowedEmail`,
- creates or updates the resident,
- creates or updates each locker and links it to that resident.

Verify the allowlist entry and locker rows before inviting the resident. Do not provision a vendor lock ID that belongs to another apartment; the command refuses to move an existing locker to a different resident.

For local or mock testing, use `vendor` `mock` and any stable ID:

```bash
pnpm provision --email you@example.com --gateway local-gw \
  --locker "Kitchen:mock:local-kitchen"
```

## 5. Resident acceptance

Ask the resident to:

1. Open the magic link sent to the invited email.
2. Confirm and name each locker on `/onboarding`.
3. Unlock and lock each locker once, confirming battery and online state.
4. Create a share link and send it to a colleague or second phone.
5. Open the activity page and confirm the events appear.
6. Open Settings → Appearance, switch to Dark, reload, and confirm it persists; then switch back to System.
7. In iPhone Safari, use Share → Add to Home Screen, open the installed app, and confirm it starts at the dashboard. Turn the connection off and confirm the offline page explains that unlocking needs a connection.
8. Sign in on a second browser, open Settings → Active sessions, confirm the device and approximate location labels look plausible, revoke the other sessions, and confirm the second browser is signed out. Change the display name and confirm it persists after reload.
9. Create a share link, extend it by minutes and unlocks, and confirm the locker page shows the new limits and an `Extended` entry in Share link history. Confirm the link still cannot exceed 24 hours or 50 total unlocks.

## 6. Guest check

- Open the share link in iPhone Safari, without installing anything.
- Confirm the page shows only the locker name, guest label, and expiry.
- With the phone in dark mode, confirm the page is dark and readable and offers no theme control.
- Tap **Unlock locker** and confirm the 30-second relock countdown appears, then wait for **Locker relocked.** and confirm the owner's locker shows **Locked**.
- Close the guest tab during the countdown and confirm the cron fallback returns the locker to **Locked** within one scheduler interval after the deadline (one minute on Vercel Pro; the configured external interval otherwise), allowing for provider failures.
- Confirm the owner receives the guest-unlock email if notifications are enabled.
- In DevTools → Network, confirm the share document sends `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, `X-Robots-Tag: noindex`, `X-Frame-Options: DENY`, and a `Content-Security-Policy` containing `frame-ancestors 'none'`. Confirm the console has no CSP errors. A share token must never be indexed or cached.
- Confirm the installed service worker never serves `/dashboard` or a `/share/*` page from its cache, and that the installed app shows the `/offline` fallback when disconnected.
- Revoke the link from the owner's locker page and confirm the guest page shows the generic unavailable message after reload.

## 7. Rollback

If the pilot must be paused:

- To pause new guest access, set `SHARING_ENABLED=false` and restart or redeploy. Creating and redeeming links is blocked; revoking links, owner lock/unlock, and guest relock still work.
- To pause unlocks while keeping locks available, set `LOCK_COMMANDS_ENABLED=false` and restart or redeploy. Owners and guests cannot unlock; owners can still lock.
- To revoke live links immediately, run `pnpm bulk-revoke --email resident@example.com --yes` or `pnpm bulk-revoke --all --yes` against the pilot database. The command requires `--yes` and exactly one of `--email` or `--all`.
- Take the app offline or block mutations at the proxy if the whole service must pause. The env switches are deploy-time changes; a running process must be restarted or redeployed before a switch takes effect.
- Setting `LOCK_PROVIDER=mock` only prevents real vendor calls. It does not pause the app; use it alongside taking the app offline if hardware must be isolated.
- Rotate vendor credentials and update the encrypted credential record once Task 15 is available.
- Tell residents the service is unavailable rather than implying the app is read-only.
- Preserve database backups according to the pilot's data-retention policy. Account deletion is still available and is permanent.

## Incident notes

- A leaked guest link can be revoked immediately; it is stored only as a hash, so the raw token cannot be recovered from the database.
- If the gateway is offline, remote unlock fails and the UI reports a failure; check apartment Wi-Fi and gateway power.
- If email delivery fails, guest unlock still succeeds by design; the owner may not receive the notification.
