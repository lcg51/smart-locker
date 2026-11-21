# Task 34: Evaluate the TTLock on-premise solution

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Pilot hardening and growth design](../../specs/2026-11-03-smart-locker-pilot-hardening-design.md).
> Phase 3 evaluation. **Depends on:** Task 32.

---

**Goal:** decide, with a quote and a data-residency answer, whether TTLock's paid on-premise deployment is worth using for a later scale-up. This task produces a decision document, not a deployment.

**Files:**
- Create: `docs/decisions/ttlock-on-premise.md`
- Modify: `docs/superpowers/plans/2026-11-01-smart-locker-mvp.md` (status line only)

**Interfaces:**
- Consumes: the cloud provider behavior (Task 15) and the quota findings from Task 32.
- Produces: a go/no-go recommendation with cost, residency, and operational conditions.

**Non-goals:** No purchase, no server provisioning, and no provider changes in this task.

- [ ] **Step 1: Request the commercial terms**

Contact TTLock through the Open Platform and ask for: setup fee, licence model, support terms, upgrade path, and whether a pilot qualifies. Record the quote and its date.

- [ ] **Step 2: Confirm data residency**

Ask where the on-premise deployment stores data and backups. The answer must keep personal data in the EU to satisfy our GDPR and LOPDGDD commitments. Record the exact wording from TTLock.

- [ ] **Step 3: Compare the API surface**

Read the on-premise section of the TTLock docs. Confirm the endpoints, auth, and request format match the cloud API so our provider only changes the base URL and token source. List every difference found.

- [ ] **Step 4: Confirm hardware support**

Ask which locks and gateways work with the on-premise deployment, and whether a gateway can report to our server instead of TTLock's cloud. This decides whether guests can still unlock remotely.

- [ ] **Step 5: Cost the operations**

Estimate the monthly cost at pilot scale and at ten times pilot scale, including hosting, backups, monitoring, and the on-call time to run it. Compare with the TTLock cloud subscription at the same scale.

- [ ] **Step 6: Write the decision document**

Use this structure: context, quote, residency answer, compatibility findings, cost comparison, recommendation (`go`, `no-go`, or `revisit at N units`), and conditions. Keep it under two pages.

- [ ] **Step 7: Get the owner's decision and commit**

Review the document with the human partner. Record the decision and date in it. Then:

```bash
git add docs/decisions/ttlock-on-premise.md docs/superpowers/plans/2026-11-01-smart-locker-mvp.md
git commit -m "docs: decide on TTLock on-premise deployment"
```

**Acceptance:**
- The document contains a dated quote, not a guess.
- The residency answer is in TTLock's own words.
- The API differences and hardware support are listed explicitly.
- It ends with an explicit decision and the scale at which it should be revisited.
