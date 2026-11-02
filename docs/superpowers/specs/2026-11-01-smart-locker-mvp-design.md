# Smart Locker MVP — Design

Date: 2026-11-01
Status: Draft for approval

## Intent

Residents have lockers inside their own apartment. They want to open them from
their phone, and they want to let someone else in — a cleaner, a guest, a
delivery — while they are away. Today the app is a client-only demo: a PIN
unlocks a dashboard of seeded rooms, lock/unlock is simulated, and all state
lives in `localStorage` behind a forgeable `authenticated=true` cookie.

The MVP exists to validate one behaviour: **people will open their apartment
lockers from their phone and share temporary access through a link.** Everything
below serves that.

## Goals

1. A resident can sign in, confirm their pre-provisioned lockers, and see each
   locker's state and battery.
2. A resident can lock and unlock a locker from the web app, whether they are
   at home or away.
3. A resident can create a share link for one locker that expires and can be
   revoked, and a guest can use that link to unlock without installing anything.
4. Every unlock attempt, by owner or guest, is recorded server-side and visible
   to the owner.
5. The app works on iPhone Safari, because guests will arrive by link on
   whatever phone they own.

## Non-goals

- Building lock hardware. We integrate a vendor's cloud and hardware.
- Native iOS/Android apps. The product is a web app, installable as a PWA.
- Building-wide management: no building admin, no shared common-area lockers,
  no multi-tenant organisations.
- Billing, subscriptions, and self-serve public signup. The MVP runs as an
  invite-only pilot.
- Offline or direct phone-to-lock unlocking. That is a later fallback, not MVP.
- Professional installation. We ship the lock and gateway with a step-by-step
  guide; the resident plugs in the gateway and fits the lock. If fitting proves
  too hard in the pilot, installation support becomes a follow-up.

## Anti-goals

These are failures even if the app technically works:

- A share link that still opens the locker after it expires or is revoked.
- A share link that can be guessed, enumerated, or replayed indefinitely.
- A guest link that exposes other lockers or owner account data.
- An owner locked out because the vendor cloud is briefly unavailable, with no
  clear error and no way to retry.
- Secrets, PINs, or session tokens readable from `localStorage`.
- A demo-grade auth cookie or plaintext PIN surviving into the pilot.

## Constraints

- Existing stack stays: Next.js 16 App Router, React 19, TypeScript, Tailwind v4,
  shadcn/ui.
- Appearance offers Light, Dark, and System. System is the default and follows
  the device's `prefers-color-scheme`; the choice is stored per browser, not on
  the account.
- One resident per account; lockers belong to that account. The current
  Room/Locker split collapses into a single `Locker` with a display name.
- The lock vendor must offer a cloud API for remote unlock plus device state and
  battery.
- Pilot market is **Spain**. Hardware must be CE-marked and usable there; the
  vendor must sell and support Spanish customers. The deployment must meet GDPR
  and LOPDGDD obligations: EU data processing, a deletion path, a privacy policy,
  and a data-processing agreement with the vendor.
- We supply the hardware: one lock per locker plus one vendor gateway per
  apartment. The gateway needs mains power and the apartment's Wi-Fi.
- Hosting target: Vercel plus a managed Postgres (Neon or Supabase), with EU
  regions where available.
- Small team, MVP timeline measured in weeks, not quarters.
- No native app means guest access is a web page, and resident access is a PWA.

## Approaches considered

1. **Rent the lock's cloud (chosen).** Integrate a locker/cabinet lock platform
   with an open API (TTLock as the reference implementation, igloohome as an
   alternative). Vendor supplies hardware, battery power, BLE, gateway, remote
   unlock, and state reporting. Our backend owns accounts, lockers, grants, and
   audit, and calls the vendor API. Fastest route to real residents with no
   hardware risk. Trade-off: vendor lock-in, per-device and API cost, dependence
   on their uptime, and Spain-specific certification and gateway availability.
2. **Build our own lock.** ESP32 plus Wi-Fi and a relay/solenoid, talking MQTT or
   HTTPS to our backend. Cheapest per locker and full control, but firmware,
   power, connectivity, certification, and support become ours. Months before a
   resident can use one. Rejected for MVP.
3. **BLE lock plus native app.** Phone talks directly to the lock; backend
   delivers keys. Works offline, but requires iOS and Android apps, and
   link-based guest access fails on iPhone because Safari has no Web Bluetooth.
   Contradicts the sharing model. Rejected.

Approach 1 was chosen because the MVP's risk is product demand, not hardware,
and a vendor removes the hardware risk from the critical path.

## Architecture

### Runtime shape

```
Resident (PWA) ─┐
                ├─ Next.js app (Vercel) ── Postgres
Guest (link)  ──┘        │
                         └─ LockProvider ── vendor cloud
                                                 │
                                    gateway (apartment Wi-Fi, mains)
                                                 │
                                               lock (BLE)
```

The Next.js app serves both the resident dashboard and the public guest page.
All state and authorization live server-side. The browser never holds a vendor
credential. Remote unlock reaches the lock through the vendor cloud and the
gateway; there is no direct phone-to-lock path in the MVP.

### Routes

| Route | Audience | Purpose |
|---|---|---|
| `/` | both | Redirect: signed-in resident to `/dashboard`, otherwise `/auth` |
| `/auth` | resident | Email magic-link sign-in; optional local PIN re-entry |
| `/dashboard` | resident | Locker cards with state, battery, lock/unlock |
| `/dashboard/lockers/[id]` | resident | Locker detail, share management, activity |
| `/dashboard/activity` | resident | Full audit log, filterable |
| `/dashboard/settings` | resident | Account, notification preference, sign out, delete data |
| `/share/[token]` | guest | Validate grant, unlock, show result and expiry |
| `/onboarding` | resident | Confirm and name the lockers we pre-provisioned |

`/dashboard/notifications` is replaced by `/dashboard/activity`; keeping the old
name would misdescribe what it now shows.

### Domain model (Postgres)

- **User**: `id`, `email` (unique), `name`, `vendorGatewayId`,
  `gatewayLastSeenAt`, `guestUnlockEmails` (default true), `createdAt`,
  `deletedAt`.
- **Locker**: `id`, `userId`, `name`, `vendor`, `vendorLockId` (unique per
  vendor), `status` (`locked` | `unlocked` | `unknown`), `batteryLevel`,
  `lastSyncedAt`, `confirmedAt`, `createdAt`, `deletedAt`. A locker belongs to
  exactly one user.
- **ShareGrant**: `id`, `lockerId`, `createdByUserId`, `tokenHash` (unique),
  `guestLabel`, `expiresAt`, `maxUses`, `usedCount`, `revokedAt`, `createdAt`.
- **LockEvent**: `id`, `lockerId`, `grantId?`, `actorType` (`owner` | `guest` |
  `system`), `action` (`unlock` | `lock`), `success`, `errorCode`, `ipHash`,
  `createdAt`. Append-only.
- **VendorCredential**: `id`, `vendor` (unique), encrypted API/OAuth tokens,
  `createdAt`, `updatedAt`. One platform-level credential for the pilot, not one
  per resident. Never sent to the browser.
- **AllowedEmail**: `email` (unique), `invitedBy`, `createdAt`, `acceptedAt`.
  Sign-in is rejected for emails that are not on this list.

A `Locker` keeps `status` and `batteryLevel` as a cache; the vendor remains the
source of truth and the cache is refreshed on read with a short TTL.

### Lock provider adapter

```ts
interface LockProvider {
  provision(input: ProvisionInput): Promise<{ vendorLockId: string }>
  unlock(vendorLockId: string): Promise<LockResult>
  lock(vendorLockId: string): Promise<LockResult>
  getState(vendorLockId: string): Promise<LockerState>
}
```

Implementations: `TTLockProvider` (reference), `MockLockProvider` (local dev,
tests, and the pilot before hardware arrives). The rest of the app depends only
on the interface, so the vendor can change without touching product code.

Guest access is a **server-side remote unlock using the platform's vendor
credential**. The `ShareGrant` row is the whole authorization record: revoking
it revokes access, with no vendor-side e-key to create, track, or reconcile.
Minting per-guest vendor e-keys is deliberately deferred; it would add a vendor
grant lifecycle and a reconciliation job for no MVP benefit, because the guest
uses our page rather than the vendor's app.

### Hardware and provisioning (pilot)

- Each apartment kit is one vendor lock per locker plus one vendor gateway. We
  buy, configure, and bind the locks to the platform credential before shipping;
  the resident never creates a vendor account.
- A resident is provisioned by an ops script: it creates the `User`, the
  `Locker` rows, and links the gateway. Their invited email is added to
  `AllowedEmail` at the same time.
- On first sign-in the resident sees their pre-provisioned lockers, confirms
  them, and names them. There is no BLE pairing in our app and no vendor app on
  the resident's phone. If the vendor requires its own app for initial binding,
  ops does that during provisioning, not the resident.
- The gateway runs on the apartment's 2.4 GHz Wi-Fi with mains power. It is the
  single point of failure for remote unlock, so the setup guide covers it and the
  UI reports it as offline when it stops checking in.
- Hardware for the pilot is CE-marked, ships with a Spanish plug where needed,
  and stays a small batch until the pilot proves demand.

### Authentication and sessions

- Auth.js (NextAuth v5) with email magic links, delivered by a transactional
  email provider. Sessions are httpOnly, secure, SameSite=Lax cookies.
- Invite-only is enforced in the sign-in callback: the email must exist in
  `AllowedEmail`. Pilot emails are seeded by an ops script, not a public form.
  An uninvited email sees a neutral "this pilot is invite-only" message.
- No passwords in the MVP. No `authenticated=true` cookie.
- The existing PIN screen becomes an optional local app lock: after a session
  exists, a resident may set a 4-digit PIN to re-enter the app quickly on that
  device. The PIN is verified client-side against a salted hash stored locally.
  It is a convenience lock, not an authentication factor, and it is documented
  as such in the UI. Signing out clears it.
- Session lifetime: 30 days, with revocation on sign-out and on account delete.

### Share flow

1. Owner opens a locker, taps **Share access**, chooses a duration (default 1
   hour, maximum 24 hours), an optional label ("Ana, cleaner"), and a maximum
   number of uses (default 5, maximum 50).
2. Server creates a `ShareGrant`, generates a 256-bit random token, stores only
   its SHA-256 hash, and returns a URL: `/share/<token>`.
3. Guest opens the URL. The page resolves the hash, checks `expiresAt`,
   `revokedAt`, and `usedCount < maxUses`, and shows only the locker's display
   name and the owner's label. It reveals nothing else.
4. Guest taps **Unlock**. The server re-checks the grant inside a transaction,
   atomically increments `usedCount`, calls the provider, and writes a
   `LockEvent`. A use is consumed only on a successful unlock.
5. The page shows success and a countdown to auto-relock, and stops offering
   further unlocks when the grant is exhausted.
6. The owner can revoke at any time. Revocation sets `revokedAt`, and the guest
   page fails closed on its next request.

Token handling: never logged, never stored in plaintext, `Referrer-Policy:
no-referrer` on the share page, rate-limited per token and per IP, and generic
error messages that do not reveal whether a token ever existed.

### Notifications

Browser `Notification` only fires while the app is open, so it is not the MVP
notification channel. Instead:

- The owner sees every guest unlock in `/dashboard/activity`.
- The owner can enable an email on each guest unlock, sent through the same
  transactional email provider.

Web push is post-MVP.

### Appearance

The resident and guest surfaces render light or dark from one set of
CSS-variable tokens in `app/globals.css`; components never hard-code colors.

- **Default:** System, so a new browser follows the device's light/dark
  preference. There must be no flash of the wrong theme on first paint.
- **Override:** a signed-in resident chooses Light, Dark, or System under
  Settings → Appearance. The preference is stored in that browser's
  `localStorage`, so it does not follow the account to another device.
- **Guest pages:** follow the device preference and show no theme control; the
  guest surface stays minimal.
- **Implementation:** a `next-themes` class on `<html>`, with `color-scheme`
  set so native controls and scrollbars match. Dialogs, the PIN pad, and the
  guest share page inherit the active theme.

### API surface

Server actions handle app mutations (confirm/rename locker, lock, unlock,
create/revoke share, settings). Route handlers are used where a browser form is not the caller:

- `GET /api/lockers/[id]/state` — short-TTL state refresh for the dashboard.
  The MVP polls; signed vendor webhooks are post-MVP unless the vendor supplies
  them during integration.

All mutations validate input with zod and authorize against the session user and
locker ownership on the server. The client is never trusted for identity.

### Failure behaviour

- Vendor unreachable: the action fails with a clear message, the `LockEvent`
  records the failure, and the UI offers retry. No optimistic "unlocked" state.
- Gateway offline or apartment Wi-Fi down: the locker shows as offline, unlock
  fails with that explanation, and the event is logged. Local BLE fallback is
  post-MVP.
- Ambiguous timeout: re-query state before showing a result; if still unknown,
  tell the resident to check the locker.
- State refresh out of order: updates are idempotent and last-write-wins by
  vendor timestamp.
- Grant exhausted or expired mid-flow: the unlock request fails closed.

### Account deletion

The settings page promises deletion, so deletion must be real and complete. On
confirmation, one transaction deletes the user's sessions, lockers, share grants,
and `LockEvent` rows. The `User` row and `AllowedEmail` row are removed last. The
vendor credential is platform-level, not the user's, so it is untouched. The MVP
keeps no anonymised audit trail after account deletion; retaining access history
is a post-MVP policy decision, not a silent default. Outstanding share links stop
resolving immediately because their grants are gone.

## Migration from the current app

| Current | Becomes |
|---|---|
| `lib/storage.ts` (`localStorage`) | Server data access + API/server actions |
| `lib/bluetooth-service.ts` | `LockProvider` adapter; `MockLockProvider` for dev |
| `types/locker.ts` `Room` + `Locker` | One `Locker` record; `Room` is just the locker's name |
| Seeded four rooms | Removed; lockers are pre-provisioned, with a setup empty state |
| `authenticated=true` cookie + `proxy.ts` | Auth.js session and server-side checks |
| PIN as the only auth | Optional local app lock, clearly non-security |
| Client-side access logs (last 100) | Server-side `LockEvent`, paginated and filterable |
| `components/room-card.tsx` | Locker card driven by server state |

`next.config.mjs` should stop ignoring TypeScript build errors before the pilot.

## Testing

- **Unit**: grant validation (expired, revoked, exhausted, unknown token),
  token hashing, adapter result mapping, PIN hash verification.
- **Integration**: create grant → redeem → revoke; concurrent redemptions of a
  `maxUses: 1` grant consume exactly one use; failed unlock does not consume a
  use; vendor failure writes a failed event.
- **End-to-end** (Playwright, mock provider): resident signs in, confirms a
  pre-provisioned locker, unlocks it, creates a share, guest redeems it, owner
  revokes it, guest is denied.
- **Appearance**: Playwright verifies the Settings choice applies immediately
  and survives a reload, and that a fresh browser with a dark
  `prefers-color-scheme` renders auth and guest pages dark.
- **Security checks**: expired and revoked links, replayed links, token
  enumeration, cross-user locker access, guest page leakage.

## Rollout

Invite-only pilot with 5–10 residents. Start on `MockLockProvider`; switch a
handful of real lockers to the vendor once provisioning and remote unlock are
verified end to end. Feature-flag the vendor provider with `LOCK_PROVIDER` so
the pilot can run on mock and switch in one environment change.

Success signals for the MVP:

- A resident confirms a locker and unlocks it at least once a week.
- At least one share link is created and redeemed per active resident per month.
- Unlock success rate above 95% excluding lock-offline cases.
- No security incident involving a share link.

## Risks

| Risk | Mitigation |
|---|---|
| Vendor API unavailable or rate-limited | Adapter boundary, clear failure UI, retry, vendor with an SLA |
| Vendor lacks Spain coverage, CE marking, or gateway stock | Evaluate two vendors for Spain before committing; adapter keeps the door open |
| Gateway or apartment Wi-Fi offline | Offline state in the UI, setup guide, support path, local BLE fallback later |
| Hardware logistics and cost | Small pilot batch, price per kit before shipping, cap lockers per account |
| GDPR/LOPDGDD non-compliance | EU hosting where possible, vendor DPA, privacy policy, real deletion path |
| Share token leaks (forwarded message) | Short expiry, use cap, revocation, rate limits, no sensitive data on the page |
| iPhone link UX (no app installed) | Plain web page, no BLE, no install step for guests |
| Lock and gateway installation friction | Illustrated setup guide, mock mode for demos, support path |
| Vendor credential compromised | Encrypt at rest, never expose to the browser, rotate on suspicion, audit every call |
| Cost per locker | Price before pilot; cap lockers per account |

## Open decisions left to the builder

- Final vendor, evaluated for Spain: CE marking, gateway availability, Spanish
  support, EU data processing, and remote-unlock API (TTLock assumed for the
  reference implementation).
- ORM (Prisma or Drizzle) and Postgres host.
- Email provider for magic links and guest-unlock notifications.
- Rate-limiting implementation (Upstash Redis or Postgres-backed).
- Auto-relock duration per vendor and how it is surfaced to the guest.
- Whether the optional local PIN ships in the first pilot build or the second.
- Whether one gateway can serve several lockers in the same apartment.
- Whether the pilot UI ships in Spanish, English, or both. The plan ships
  English copy first.

## Decisions made in this design (check these)

- The pilot runs in Spain, with CE-marked hardware and GDPR/LOPDGDD handling.
- The first pilot build uses English UI copy; Spanish is a follow-up.
- We supply and pre-provision the lock and gateway; residents never use a vendor
  app, and the platform holds one vendor credential.
- A gateway in each apartment is accepted; remote unlock depends on the
  apartment's Wi-Fi and mains power.
- Guest access needs no account; the link is the credential.
- Guest unlocks are server-side remote unlocks; no per-guest vendor e-keys in
  the MVP, so revoking the grant is sufficient.
- One resident per account; no building admin in the MVP.
- Appearance defaults to the device preference; residents can override to
  Light, Dark, or System in Settings, per browser. Guest pages follow the device
  setting and show no theme control.
- Invite-only is enforced by an `AllowedEmail` allowlist checked at sign-in.
- The PIN stops being an authentication factor.
- The old `Room` concept is folded into `Locker`.
- Email, not browser notifications, carries guest-unlock alerts.
- Account deletion hard-deletes account data, including audit events.
