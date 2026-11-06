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
- Set production values for `APP_URL`, `AUTH_SECRET`, `EMAIL_FROM`, and `RESEND_API_KEY`.
- Verify the Resend sending domain and add the required DNS records before inviting residents.
- Configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` if the app runs more than one instance; otherwise rate limits are per-process.
- Set `CRON_SECRET` to a random value of at least 16 characters and keep it in the deployment's secret store. The relock fallback returns `503` until it is set.
- Confirm `/api/cron/relock` is scheduled every minute (`vercel.json`). Vercel Hobby does not allow one-minute crons; on that plan, schedule the endpoint with an external scheduler and record the actual interval in the pilot log. The fallback runs within one scheduler interval after `relockAt` becomes due; provider or scheduler failures can delay it further.
- Put a trusted proxy in front of the app so the first `x-forwarded-for` entry is the real client IP. The share limiter keys on that value.
- Keep `LOCK_PROVIDER=mock` until hardware and Task 15 are ready.

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

## 6. Guest check

- Open the share link in iPhone Safari, without installing anything.
- Confirm the page shows only the locker name, guest label, and expiry.
- With the phone in dark mode, confirm the page is dark and readable and offers no theme control.
- Tap **Unlock locker** and confirm the 30-second relock countdown appears, then wait for **Locker relocked.** and confirm the owner's locker shows **Locked**.
- Close the guest tab during the countdown and confirm the cron fallback returns the locker to **Locked** within one scheduler interval after the deadline (one minute on Vercel Pro; the configured external interval otherwise), allowing for provider failures.
- Confirm the owner receives the guest-unlock email if notifications are enabled.
- Revoke the link from the owner's locker page and confirm the guest page shows the generic unavailable message after reload.

## 7. Rollback

If the pilot must be paused:

- Take the app offline or block mutations at the proxy. There is no operator-wide read-only switch, and mock mode still simulates successful lock/unlock commands.
- Setting `LOCK_PROVIDER=mock` only prevents real vendor calls. It does not pause the app; use it alongside taking the app offline if hardware must be isolated.
- Revoke active share grants from each owner's locker page. There is no bulk revoke control, so if links must stop immediately, take the app offline and remove guest access at the network layer.
- Rotate vendor credentials and update the encrypted credential record once Task 15 is available.
- Tell residents the service is unavailable rather than implying the app is read-only.
- Preserve database backups according to the pilot's data-retention policy. Account deletion is still available and is permanent.

## Incident notes

- A leaked guest link can be revoked immediately; it is stored only as a hash, so the raw token cannot be recovered from the database.
- If the gateway is offline, remote unlock fails and the UI reports a failure; check apartment Wi-Fi and gateway power.
- If email delivery fails, guest unlock still succeeds by design; the owner may not receive the notification.
