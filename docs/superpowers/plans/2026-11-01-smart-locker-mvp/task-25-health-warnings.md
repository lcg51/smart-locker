# Task 25: Battery and gateway health warnings

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Pilot hardening and growth design](../../specs/2026-11-03-smart-locker-pilot-hardening-design.md).
> Phase 2. **Depends on:** Task 05, Task 08, Task 15.

---

**Files:**
- Create: `lib/health/status.ts`, `components/locker-health-badge.tsx`
- Modify: `components/locker-card.tsx`, `app/dashboard/page.tsx`, `app/dashboard/lockers/[id]/page.tsx`
- Modify: `lib/lockers/queries.ts` (return the resident gateway timestamp with lockers)
- Modify: `README.md`, `docs/pilot-setup-guide.md`
- Test: `tests/health/status.test.ts`, `e2e/health.spec.ts`

**Interfaces:**
- Consumes: `Locker.batteryLevel`, `LockerState.online`, `Locker.lastSyncedAt`, `User.gatewayLastSeenAt`.
- Produces:
  - `getLockerHealth(input: { batteryLevel: number | null; online: boolean | null; gatewayLastSeenAt: Date | null; now?: Date }): { level: "ok" | "warning" | "critical" | "unknown"; reasons: string[] }`
  - `LockerHealthBadge({ health }: { health: LockerHealth })`
  - dashboard warning banner and detail-page reason list.

**Non-goals:** No push notification, no email alert, no vendor-side battery prediction, and no alert when the data is unknown.

- [ ] **Step 1: Write the failing health test**

Create `tests/health/status.test.ts`:

```ts
it("warns at 20 percent battery and treats 10 percent as critical", () => {
  expect(getLockerHealth({ batteryLevel: 20, online: true, gatewayLastSeenAt: null }).level).toBe("warning")
  expect(getLockerHealth({ batteryLevel: 10, online: true, gatewayLastSeenAt: null }).level).toBe("critical")
})

it("warns when the gateway has not been seen for 15 minutes", () => {
  const now = new Date("2026-11-03T10:00:00.000Z")
  const health = getLockerHealth({
    batteryLevel: 80,
    online: true,
    gatewayLastSeenAt: new Date("2026-11-03T09:40:00.000Z"),
    now,
  })
  expect(health).toMatchObject({ level: "warning", reasons: ["Gateway has not reported for 20 minutes."] })
})

it("returns unknown without inventing an alert when data is missing", () => {
  expect(getLockerHealth({ batteryLevel: null, online: null, gatewayLastSeenAt: null })).toEqual({
    level: "unknown",
    reasons: [],
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/health/status.test.ts`
Expected: FAIL because `getLockerHealth` does not exist.

- [ ] **Step 3: Implement the health rules**

Create `lib/health/status.ts` with the signature above:

- Battery `<= 10` -> critical reason `Battery is critically low (N%).`
- Battery `<= 20` -> warning reason `Battery is low (N%).`
- `online === false` -> warning reason `The locker is offline.`
- `gatewayLastSeenAt` older than 15 minutes -> warning reason `Gateway has not reported for N minutes.`
- Any critical reason makes the level `critical`; any warning makes it `warning`; otherwise `ok`. If every input is null, return `unknown`.
- Keep reasons stable and test-friendly.

- [ ] **Step 4: Load the gateway timestamp**

Add `getResidentGateway(userId)` to `lib/lockers/queries.ts` returning `prisma.user.findUnique({ where: { id: userId }, select: { gatewayLastSeenAt: true } })`.

In `app/dashboard/page.tsx`, fetch it alongside the lockers and extend the card prop to `LockerCard({ locker, gatewayLastSeenAt }: { locker: Locker; gatewayLastSeenAt: Date | null })`. Do not add a second query per card. In `app/dashboard/lockers/[id]/page.tsx`, fetch the same resident gateway value for the detail health block.

- [ ] **Step 5: Show the warnings**

Create `components/locker-health-badge.tsx`:

- `warning` -> `Needs attention` badge using the existing secondary/amber-safe tokens.
- `critical` -> `Critical` badge using the destructive tokens from Task 14.
- `unknown` -> no badge.
- Include the first reason as visible text or a tooltip; keep the badge's accessible name meaningful.

In `components/locker-card.tsx`, render the badge near the status and battery line and add the reasons below the status row when present.

In `app/dashboard/page.tsx`, add a banner above the grid when at least one locker is not `ok`: `N lockers need attention`, with anchor links to each affected locker's detail page. If there are none, render nothing.

In `app/dashboard/lockers/[id]/page.tsx`, show the reason list and `Last checked …` next to the battery/status block.

- [ ] **Step 6: Add the E2E check**

Create `e2e/health.spec.ts`:

```ts
test("the dashboard warns about a low battery and a stale gateway", async ({ page, context }) => {
  await context.request.post("/api/test/session", { data: { email: "ana@example.com" } })
  // Use Prisma in the test to set the seeded locker battery to 15 and the user's
  // gatewayLastSeenAt to 30 minutes ago; restore both in a finally block.
  await page.goto("/dashboard")
  await expect(page.getByText("1 locker needs attention")).toBeVisible()
  await expect(page.getByText("Battery is low (15%).")).toBeVisible()
})
```

Use the existing E2E seed and Prisma helper; restore the rows after the assertion so later tests are unaffected.

Run: `pnpm test:e2e e2e/health.spec.ts`
Expected: PASS.

- [ ] **Step 7: Update the docs**

- `README.md`: document the thresholds and that warnings are advisory.
- `docs/pilot-setup-guide.md`: add a resident acceptance step for the low-battery/offline warning and a note that Task 15 populates real gateway timestamps.

- [ ] **Step 8: Run the full verification**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`
Expected: lint clean, typecheck clean, all tests pass, build passes, and every E2E test passes.

- [ ] **Step 9: Commit**

```bash
git add lib/health components/locker-health-badge.tsx components/locker-card.tsx app/dashboard lib/lockers/queries.ts tests/health e2e/health.spec.ts README.md docs/pilot-setup-guide.md
git commit -m "feat: warn about low batteries and stale gateways"
```
