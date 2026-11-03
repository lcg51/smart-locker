# Task 26: Pilot metrics report

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Pilot hardening and growth design](../../specs/2026-11-03-smart-locker-pilot-hardening-design.md).
> Phase 2. **Depends on:** Task 08, Task 09.

---

**Files:**
- Create: `lib/metrics/queries.ts`, `scripts/pilot-metrics.ts`, `docs/pilot-metrics.md`
- Modify: `package.json` (`metrics` script), `README.md`
- Test: `tests/metrics/queries.test.ts`

**Interfaces:**
- Consumes: `prisma`, the existing `LockEvent`, `ShareGrant`, and `Locker` models.
- Produces:
  - `getPilotMetrics(input: { from: Date; to: Date; now?: Date }): Promise<PilotMetrics>`
  - `type PilotMetrics` with `activeResidents`, `ownerUnlocks`, `guestUnlocks`, `failedUnlocks`, `unlockSuccessRate`, `sharesCreated`, `sharesRedeemed`, `shareConversionRate`, `revokedShares`, `expiredShares`.
  - `pnpm metrics --from YYYY-MM-DD --to YYYY-MM-DD` printing Markdown and JSON.

**Non-goals:** No dashboard UI, no client analytics, no new tracking on `/share/*`, and no data warehouse.

- [ ] **Step 1: Write the failing metrics test**

Create `tests/metrics/queries.test.ts`:

```ts
it("reports the pilot success signals for a date window", async () => {
  // Seed: 2 residents, 3 owner unlocks, 2 guest unlocks (1 failed),
  // 2 grants created, 1 grant redeemed, 1 grant revoked.
  const metrics = await getPilotMetrics({
    from: new Date("2026-10-01T00:00:00.000Z"),
    to: new Date("2026-11-01T00:00:00.000Z"),
    now: new Date("2026-11-03T00:00:00.000Z"),
  })

  expect(metrics).toMatchObject({
    activeResidents: 2,
    ownerUnlocks: 3,
    guestUnlocks: 1,
    failedUnlocks: 1,
    sharesCreated: 2,
    sharesRedeemed: 1,
  })
  expect(metrics.unlockSuccessRate).toBeCloseTo(0.8)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/metrics/queries.test.ts`
Expected: FAIL because `getPilotMetrics` does not exist.

- [ ] **Step 3: Implement the query**

Create `lib/metrics/queries.ts`. Use one `lockEvent.findMany` for the window with `select: { actorType, success, grantId, locker: { select: { userId: true } } }` and one `shareGrant.findMany` for grants created in the window. Compute:

- `activeResidents`: distinct `locker.userId` among events with `success: true` and `actorType` in `OWNER`/`GUEST`.
- `ownerUnlocks` / `guestUnlocks`: successful unlock events by actor.
- `failedUnlocks`: failed unlock events.
- `unlockSuccessRate`: successful unlocks divided by all unlock attempts; `0` when there are none.
- `sharesCreated`: grants with `createdAt` in the window.
- `sharesRedeemed`: distinct `grantId` values among successful guest unlock events.
- `shareConversionRate`: `sharesRedeemed / sharesCreated`; `0` when no shares were created.
- `revokedShares`: grants created in the window with `revokedAt != null`.
- `expiredShares`: grants created in the window with `revokedAt == null` and `expiresAt < now`.

Return numbers rounded only at the presentation layer.

- [ ] **Step 4: Add the CLI**

Create `scripts/pilot-metrics.ts` using `node:util.parseArgs` for `--from` and `--to`. Default to the last 28 days. Validate ISO dates and `from < to`. Print a Markdown table and then a fenced JSON block. Exit non-zero on invalid input or a database error.

Add to `package.json`:

```json
"metrics": "dotenv -e .env -- tsx scripts/pilot-metrics.ts"
```

- [ ] **Step 5: Document the definitions**

Create `docs/pilot-metrics.md` with:

- The exact definition of each metric and the SQL/Prisma interpretation.
- The MVP success signals from the design: weekly resident unlock, monthly share per active resident, 95% unlock success excluding offline, no share-token incident.
- How to run the report and how to read a zero denominator.
- A note that the report is read-only and contains no guest PII.

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm test tests/metrics/queries.test.ts`
Expected: PASS.

- [ ] **Step 7: Run the report against the local database**

Run: `pnpm metrics --from 2026-10-01 --to 2026-11-01`
Expected: a Markdown table and JSON, no writes. If the local database has no events, every count is `0` and the rates are `0`.

- [ ] **Step 8: Update the README**

Add a short "Pilot metrics" section linking `docs/pilot-metrics.md` and the command.

- [ ] **Step 9: Run the full verification**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`
Expected: lint clean, typecheck clean, all tests pass, build passes, and every E2E test passes.

- [ ] **Step 10: Commit**

```bash
git add lib/metrics scripts/pilot-metrics.ts docs/pilot-metrics.md package.json tests/metrics README.md
git commit -m "feat: add the pilot metrics report"
```
