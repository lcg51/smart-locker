# Task 21: Emergency controls and ops runbook

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Pilot hardening and growth design](../../specs/2026-11-03-smart-locker-pilot-hardening-design.md).
> Phase 1.5. **Depends on:** Task 06, Task 07, Task 08, Task 19.

---

**Files:**
- Create: `lib/ops/controls.ts`, `lib/ops/bulk-revoke.ts`, `scripts/bulk-revoke.ts`
- Modify: `lib/env.ts`, `.env.example`, `.env.test.example`, `package.json` (`bulk-revoke` script)
- Modify: `lib/shares/service.ts`, `lib/shares/redeem.ts`, `app/actions/shares.ts`
- Modify: `lib/lockers/service.ts`, `app/actions/lockers.ts`
- Modify: `components/share-dialog.tsx`, `components/locker-card.tsx`
- Modify: `docs/pilot-setup-guide.md`, `README.md`
- Test: `tests/ops/controls.test.ts`, `tests/ops/bulk-revoke.test.ts`, `tests/shares/service.test.ts`, `tests/lockers/service.test.ts`

**Interfaces:**
- Consumes: `getEnv()`, `prisma`, `getRateLimiter()` from Task 19.
- Produces:
  - `isSharingEnabled(env?: Env): boolean`
  - `isLockCommandsEnabled(env?: Env): boolean`
  - `bulkRevokeGrants(input: { all?: boolean; email?: string; now?: Date }): Promise<{ revoked: number }>`
  - env `SHARING_ENABLED` and `LOCK_COMMANDS_ENABLED`, both default `true`.
  - `pnpm bulk-revoke --email <address> --yes` and `pnpm bulk-revoke --all --yes`.

**Non-goals:** No admin UI, no operator role, no audit of the operator, and no read-only mode for the whole site.

- [ ] **Step 1: Write the failing control tests**

Create `tests/ops/controls.test.ts`:

```ts
it("blocks sharing only when SHARING_ENABLED is false", () => {
  expect(isSharingEnabled(parseEnv({ ...validEnv, SHARING_ENABLED: "false" }))).toBe(false)
  expect(isSharingEnabled(parseEnv({ ...validEnv, SHARING_ENABLED: "true" }))).toBe(true)
})

it("blocks unlock commands only when LOCK_COMMANDS_ENABLED is false", () => {
  expect(isLockCommandsEnabled(parseEnv({ ...validEnv, LOCK_COMMANDS_ENABLED: "false" }))).toBe(false)
})
```

Create `tests/ops/bulk-revoke.test.ts`:

```ts
it("revokes only the requested resident's live grants", async () => {
  const result = await bulkRevokeGrants({ email: "ana@example.com", now })
  expect(result.revoked).toBe(2)
  const live = await prisma.shareGrant.count({ where: { createdByUserId: ana.id, revokedAt: null } })
  expect(live).toBe(0)
})
```

Add service tests:

```ts
it("refuses to create or redeem a share while sharing is disabled", async () => {
  vi.stubEnv("SHARING_ENABLED", "false")
  await expect(createShareGrant({ userId, lockerId })).rejects.toMatchObject({ code: "sharing_disabled" })
  await expect(redeemShareToken({ token, ip: "203.0.113.1" })).resolves.toEqual({ ok: false, reason: "sharing_disabled" })
})

it("still locks while unlock commands are disabled", async () => {
  vi.stubEnv("LOCK_COMMANDS_ENABLED", "false")
  await expect(unlockLockerForUser({ userId, lockerId, provider })).resolves.toMatchObject({ ok: false, errorCode: "commands_disabled" })
  await expect(lockLockerForUser({ userId, lockerId, provider })).resolves.toMatchObject({ ok: true })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test tests/ops/controls.test.ts tests/ops/bulk-revoke.test.ts tests/shares/service.test.ts tests/lockers/service.test.ts`
Expected: FAIL because the controls and bulk revoke do not exist.

- [ ] **Step 3: Add the env switches**

In `lib/env.ts`:

```ts
SHARING_ENABLED: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
LOCK_COMMANDS_ENABLED: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
```

Add `SHARING_ENABLED=true` and `LOCK_COMMANDS_ENABLED=true` to both env templates.

Create `lib/ops/controls.ts` with the two functions, each accepting an optional `Env` so tests can pass `parseEnv(...)` without mutating the module cache.

- [ ] **Step 4: Enforce the switches**

- `createShareGrant`: if sharing is disabled, throw `ShareLimitError("sharing_disabled")` (extend the code union).
- `resolveShareTokenAt`: if sharing is disabled, return `{ ok: false, reason: "sharing_disabled" }`; add `"sharing_disabled"` to `GrantFailure["reason"]` and `RedeemResult`.
- `redeemShareToken`: if sharing is disabled, return that same failure before the rate limit and provider call.
- `runLockCommand`: if the command is `unlock` and lock commands are disabled, return `{ ok: false, errorCode: "commands_disabled" }`. Do not block `lock`.
- `revokeShareGrant` and `revokeShare` remain available while sharing is disabled.

Map `sharing_disabled` in `components/share-dialog.tsx` to `Sharing is paused. Try again later.` and `commands_disabled` in `components/locker-card.tsx` to `Unlock is paused. You can still lock the locker.` The guest page maps `sharing_disabled` to the existing generic unavailable message.

- [ ] **Step 5: Add the bulk-revoke CLI**

Create `lib/ops/bulk-revoke.ts` with `bulkRevokeGrants`. It requires exactly one of `all` or `email`; it updates only grants with `revokedAt: null` and sets `revokedAt = now`. It returns the count. For `--email`, normalize the address and resolve the user; if the user does not exist, return `{ revoked: 0 }`.

Create `scripts/bulk-revoke.ts` using `node:util.parseArgs` with `--email`, `--all`, and `--yes`. Refuse to run without `--yes` and print the count. Add to `package.json`:

```json
"bulk-revoke": "dotenv -e .env -- tsx scripts/bulk-revoke.ts"
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test tests/ops/controls.test.ts tests/ops/bulk-revoke.test.ts tests/shares/service.test.ts tests/lockers/service.test.ts`
Expected: PASS.

- [ ] **Step 7: Update the rollback runbook**

In `docs/pilot-setup-guide.md`:

- Document `SHARING_ENABLED=false` (create/redeem blocked; revoke/lock still work).
- Document `LOCK_COMMANDS_ENABLED=false` (unlock blocked; lock still works).
- Document `pnpm bulk-revoke --email ... --yes` and `--all --yes`.
- State that these are deploy-time env changes; a running process must be restarted or redeployed.
- Remove the old claim that there is no operator-wide control.

In `README.md`, list both switches in the configuration table.

- [ ] **Step 8: Run the full verification**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`
Expected: lint clean, typecheck clean, all tests pass, build passes, and every E2E test passes.

- [ ] **Step 9: Commit**

```bash
git add lib/ops lib/env.ts .env.example .env.test.example package.json lib/shares lib/lockers app/actions components tests docs/pilot-setup-guide.md README.md scripts/bulk-revoke.ts
git commit -m "feat: add emergency sharing and unlock controls"
```
