# Decision: local Bluetooth control with the TTLock SDK

- **Date:** 2026-11-21
- **Status:** Proposed — awaiting owner sign-off
- **Task:** 33
- **Decision owner:** Luis
- **Reopens if:** the conditions in "What would change this decision" hold

## Question

Can owners unlock without the TTLock cloud API, by talking to the lock over
Bluetooth with TTLock's SDK, so that API quota and subscription cost stop being
a constraint?

## Findings

### 1. Licence and access

- TTLock states that building your own platform on its SDKs is **free**
  ([Getting started, section 5](https://euopen.ttlock.com/document-pages/en/userGuide/getStarted)).
  No per-unlock royalty is documented.
- The SDK still requires an **approved developer application** and the resulting
  `clientId`. The app-approval process is the same one we already use.
- The SDK is distributed as GitHub demos and Maven artifacts, for example
  `com.ttlock:ttlock:3.5.7` in the
  [Android SDK demo](https://github.com/ttlock/Android_SDK_Demo).
- Not confirmed: whether TTLock must whitelist the app's package name and signing
  certificate. This must be asked before any spike.

### 2. Platform options

- Native **Android and iOS** SDKs are the documented route; TTLock calls them
  "native SDKs for Android and iOS"
  ([eKey guide](https://euopen.ttlock.com/document-pages/en/userGuide/ekey)).
- A **Flutter SDK** is also listed
  ([Flutter SDK](https://euopen.ttlock.com/document-pages/en/userGuide/flutter)).
- The current product is a PWA. TTLock's own FAQ is explicit: a **web client
  cannot control a lock over Bluetooth**; it must go
  "H5 page → API → Cloud server → Gateway → Lock"
  ([FAQ, Integration 4](https://euopen.ttlock.com/document-pages/en/example/FAQ)).
  Local control therefore needs a shipped native (or wrapped) app, not the
  browser.

### 3. Feature loss

Local Bluetooth means the phone must be within range of the lock. The effects:

| Current flow | With local-only control |
|---|---|
| Guest opens a link in any browser and unlocks | **Stops working.** Guests would need the app installed and to stand at the lock. |
| Server relocks 30 seconds after a guest unlock (Task 16) | **Stops working.** The server has no channel to the lock. Only the lock's own auto-lock timer could approximate it. |
| Owner unlocks while away | Stops working for owners on Bluetooth; needs the cloud or gateway. |
| Unlock history reaches the dashboard | **Stops working without a gateway.** TTLock: without a gateway, records "can't be returned to the server automatically" ([FAQ, Gateway 6](https://euopen.ttlock.com/document-pages/en/example/FAQ)). |
| Revoking a guest's access | Becomes an eKey revocation, not a link revocation, and needs the guest's app to sync. |

The guest flow is the product's differentiator. Losing it is the decisive
finding.

### 4. Security model

- Today the server holds the encrypted cloud token; residents and guests never
  receive a key. Access ends when the server stops calling the API.
- With the SDK, each user's phone holds an **eKey** that TTLock's server issues.
  Unlocking happens phone-to-lock, with the key material on the device
  ([eKey guide](https://euopen.ttlock.com/document-pages/en/userGuide/ekey)).
- Revocation exists in the cloud API (`delete ekey`, `freeze ekey`), but a phone
  that is offline at revocation time may keep working until its validity ends.
  The exact offline window is **not documented** and must be confirmed.
- A lost phone therefore becomes a lock-security event in a way it is not
  today, where the phone only holds a session cookie.

### 5. Effort (estimates, not quotes)

Assumptions: one developer, existing PWA kept for residents, native app built
only for lock control.

| Step | Estimate |
|---|---|
| Spike with one real lock and the Android SDK | 3–5 days |
| Android pilot release (app shell, auth, eKey sync, unlock, revoke, store review) | 3–4 weeks |
| iOS release after Android | +2–3 weeks |
| Ongoing dual-app maintenance | +1–2 days per month |

The app-store review and the loss of "no app needed" are not reflected in these
numbers.

## Recommendation

**No-go for the pilot.** Keep the cloud API, with the quota reduction and guard
from Task 32.

Reasons, in order:

1. The free tier is **30,000 calls per month per application**
   ([FAQ, Open Platform 6](https://euopen.ttlock.com/document-pages/en/example/FAQ)).
   That is large for a pilot. The quota problem is more likely to be polling and
   redundant reads (Task 32) than the total volume.
2. Local control removes the guest link model, the server-side relock guarantee,
   and the dashboard history. Those are core product promises.
3. It adds two apps, two store reviews, and a new key-security model, for a
   saving that Task 32 may remove entirely.

A narrower **owner-only Bluetooth fallback** is technically possible, but it is
not worth building before the quota data from Task 32 shows a real limit being
hit. It would also not help guests, who are the higher-volume flow.

## Conditions and what would change this decision

Reopen the evaluation if any of these becomes true:

- Task 32's measured usage approaches the confirmed monthly limit in normal
  pilot use, and the upgrade price is unacceptable.
- Residents accept installing an app, and the guest flow is deliberately
  redesigned (for example, a resident unlocks for the guest).
- Connectivity between the gateway and the cloud proves unreliable in the
  building, making cloud-only control fail more often than app-based control.
- TTLock changes the free quota or the SDK terms.

## Open questions for TTLock

1. Must the app's package name and signing certificate be whitelisted?
2. How long can a revoked eKey still unlock if the phone never comes online?
3. Does the free SDK licence allow a commercial pilot and an App Store release?

## Sources

- [Getting started](https://euopen.ttlock.com/document-pages/en/userGuide/getStarted)
- [Unlock with APP (eKey)](https://euopen.ttlock.com/document-pages/en/userGuide/ekey)
- [Frequently Asked Questions](https://euopen.ttlock.com/document-pages/en/example/FAQ)
- [Android SDK demo](https://github.com/ttlock/Android_SDK_Demo)
- [Flutter SDK](https://euopen.ttlock.com/document-pages/en/userGuide/flutter)
