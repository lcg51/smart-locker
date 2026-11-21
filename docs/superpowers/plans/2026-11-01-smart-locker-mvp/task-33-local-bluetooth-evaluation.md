# Task 33: Evaluate local Bluetooth control with the TTLock SDK

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Pilot hardening and growth design](../../specs/2026-11-03-smart-locker-pilot-hardening-design.md).
> Phase 3 evaluation. **Depends on:** Task 32.

---

**Goal:** decide, with evidence, whether owners can be served by phone-to-lock Bluetooth control through TTLock's free SDK, and what that would cost in features, security, and effort. This task produces a decision document, not production code.

**Files:**
- Create: `docs/decisions/ttlock-local-bluetooth.md`
- Modify: `docs/superpowers/plans/2026-11-01-smart-locker-mvp.md` (status line only)

**Interfaces:**
- Consumes: the current cloud provider behavior (Task 15) and the quota findings from Task 32.
- Produces: a go/no-go recommendation with the conditions that would change it.

**Non-goals:** No native app, no SDK integration, and no change to the production provider in this task.

- [ ] **Step 1: Confirm the licence terms**

Read the TTLock Open Platform SDK section and the developer application terms. Record whether a commercial pilot app may use the free SDK, and whether it needs the approved developer application. Quote the source.

- [ ] **Step 2: Confirm the platform options**

Record the Android, iOS, and Flutter SDK availability and versions. Compare a native app, a Flutter build, and a Capacitor wrapper around the current PWA. State whether the existing PWA can stay as the owner-facing UI.

- [ ] **Step 3: State the feature loss precisely**

Local Bluetooth requires the phone to be near the lock. List which current flows stop working: guest unlock from a link on any device, guest relock from the server, and the owner unlocking while away. For each, state whether a fallback exists (for example, owners keep the cloud path and guests keep remote unlock).

- [ ] **Step 4: Compare the security model**

Compare the server-held cloud token (today) with eKeys stored on the phone. Record what happens when a phone is lost, how a key is revoked, and whether the server retains an audit trail.

- [ ] **Step 5: Estimate the effort**

Give a range for a spike with one lock, a pilot release on one platform, and both platforms. Include the app-store review time and the work to keep the PWA as the shared UI.

- [ ] **Step 6: Write the decision document**

Use this structure: context, findings, recommendation (`go`, `no-go`, or `go for owner-only`), conditions, and what would change the decision. Keep it under two pages.

- [ ] **Step 7: Get the owner's decision and commit**

Review the document with the human partner. Record the decision and date in it. Then:

```bash
git add docs/decisions/ttlock-local-bluetooth.md docs/superpowers/plans/2026-11-01-smart-locker-mvp.md
git commit -m "docs: decide on TTLock local Bluetooth control"
```

**Acceptance:**
- The document answers all five questions, each with a source or a measurement.
- It names the flows that would stop working, or states that none would.
- It ends with an explicit decision and the conditions that would reopen it.
