# Pilot Setup Guide

This guide is for the operator running the first Smart Locker pilot in Spain. It covers hardware, vendor credentials, resident provisioning, deployment, and acceptance checks.

## 1. Hardware

- Procure CE-marked locker locks compatible with the chosen vendor, plus one vendor gateway per apartment.
- Confirm the locks use the vendor's remote unlock API and do not require a resident-facing vendor account.
- Buy a small pilot batch first; confirm range, power, and gateway behavior in the actual apartment.
- Record each lock's vendor ID and the gateway's vendor ID before provisioning. These values are required in the `Locker` rows and `User.vendorGatewayId`.
- Check that the gateway runs on the apartment's 2.4 GHz Wi-Fi and has mains power. It is the single point of failure for remote unlock.

## 2. Vendor credentials

- Create the lock vendor's developer account and obtain API credentials.
- Phase 1 uses `LOCK_PROVIDER=mock`; do not point the pilot at real hardware until Phase 2 is complete.
- When Task 14 lands, run:

```bash
pnpm tsx scripts/seed-vendor-credential.ts
```

with `TTLOCK_ACCESS_TOKEN` and `CREDENTIAL_ENCRYPTION_KEY` set. The script does not exist in Phase 1; until it does, keep `LOCK_PROVIDER=mock`.

## 3. Provision an apartment

Run the provisioning command against the pilot database:

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

## 4. Deploy

- Use PostgreSQL in an EU region where available. Confirm the provider's region and backup policy.
- Run `pnpm db:deploy` against the production database. Do not use `prisma migrate reset` outside the test environment.
- Set production values for `APP_URL`, `AUTH_SECRET`, `EMAIL_FROM`, and `RESEND_API_KEY`.
- Verify the Resend sending domain and add the required DNS records before inviting residents.
- Configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` if the app runs more than one instance; otherwise rate limits are per-process.
- Put a trusted proxy in front of the app so the first `x-forwarded-for` entry is the real client IP. The share limiter keys on that value.
- Keep `LOCK_PROVIDER=mock` until hardware and Task 14 are ready.

## 5. Resident acceptance

Ask the resident to:

1. Open the magic link sent to the invited email.
2. Confirm and name each locker on `/onboarding`.
3. Unlock and lock each locker once, confirming battery and online state.
4. Create a share link and send it to a colleague or second phone.
5. Open the activity page and confirm the events appear.

## 6. Guest check

- Open the share link in iPhone Safari, without installing anything.
- Confirm the page shows only the locker name, guest label, and expiry.
- Tap **Unlock locker** and confirm the 30-second relock countdown appears.
- Confirm the owner receives the guest-unlock email if notifications are enabled.
- Revoke the link from the owner's locker page and confirm the guest page shows the generic unavailable message after reload.

## 7. Rollback

If the pilot must be paused:

- Set `LOCK_PROVIDER=mock` and redeploy, or disable the affected lockers.
- Revoke active share grants from the owner pages.
- Rotate vendor credentials and update the encrypted credential record once Task 14 is available.
- Tell residents the app is read-only or unavailable; do not leave active guest links working.
- Preserve database backups according to the pilot's data-retention policy. Account deletion is still available and is permanent.

## Incident notes

- A leaked guest link can be revoked immediately; it is stored only as a hash, so the raw token cannot be recovered from the database.
- If the gateway is offline, remote unlock fails and the UI reports a failure; check apartment Wi-Fi and gateway power.
- If email delivery fails, guest unlock still succeeds by design; the owner may not receive the notification.
