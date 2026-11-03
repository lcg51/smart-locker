# Task 19: Abuse and rate-limit hardening

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Pilot hardening and growth design](../../specs/2026-11-03-smart-locker-pilot-hardening-design.md).
> Phase 1.5. **Depends on:** Task 04, Task 06, Task 07.

---

**Files:**
- Create: `lib/auth/rate-limit.ts`
- Modify: `app/auth/actions.ts`
- Modify: `lib/shares/service.ts`, `app/actions/shares.ts`
- Modify: `lib/lockers/service.ts`, `app/actions/lockers.ts`
- Modify: `components/share-dialog.tsx`, `components/locker-card.tsx`
- Modify: `README.md`, `docs/pilot-setup-guide.md`
- Test: `tests/auth/rate-limit.test.ts`, `tests/shares/service.test.ts`, `tests/lockers/service.test.ts`

**Interfaces:**
- Consumes: `RateLimiter` and `getRateLimiter()` from `lib/rate-limit.ts`, `headers()` from `next/headers`, `getEnv()`.
- Produces:
  - `checkMagicLinkRateLimit(input: { email: string; ip: string; limiter?: RateLimiter; now?: () => number }): Promise<boolean>`
  - `createShareGrant` throws `ShareLimitError` with `code: "rate_limited" | "share_limit_reached"`.
  - `CreateShareResult = { ok: true; url: string; grantId: string } | { ok: false; error: "rate_limited" | "share_limit_reached" | "invalid_input" }`
  - `LockerActionResult` gains `errorCode: "rate_limited"`.

**Non-goals:** No CAPTCHA, no account lockout, no per-IP ban list, and no change to the guest failure copy.

- [ ] **Step 1: Write the failing rate-limit tests**

Create `tests/auth/rate-limit.test.ts`:

```ts
it("allows five magic links per normalized email per ten minutes", async () => {
  const limiter = createInMemoryRateLimiter(() => now)
  for (let i = 0; i < 5; i += 1) {
    await expect(checkMagicLinkRateLimit({ email: " Ana@Example.com ", ip: "203.0.113.1", limiter })).resolves.toBe(true)
  }
  await expect(checkMagicLinkRateLimit({ email: "ana@example.com", ip: "203.0.113.1", limiter })).resolves.toBe(false)
})
```

Add to `tests/shares/service.test.ts`:

```ts
it("rejects share creation after ten grants in an hour", async () => {
  const limiter = createInMemoryRateLimiter(() => now)
  for (let i = 0; i < 10; i += 1) {
    await createShareGrant({ userId, lockerId, limiter, now })
  }
  await expect(createShareGrant({ userId, lockerId, limiter, now })).rejects.toMatchObject({ code: "rate_limited" })
})

it("caps active grants at twenty per locker", async () => {
  // seed twenty live grants; use a limiter that always allows
  await expect(createShareGrant({ userId, lockerId, limiter: allowAllLimiter() }))
    .rejects.toMatchObject({ code: "share_limit_reached" })
})
```

Add to `tests/lockers/service.test.ts`:

```ts
it("rate-limits owner commands per resident", async () => {
  const limiter = createInMemoryRateLimiter(() => now)
  for (let i = 0; i < 30; i += 1) {
    await unlockLockerForUser({ userId, lockerId, provider, limiter })
  }
  await expect(unlockLockerForUser({ userId, lockerId, provider, limiter }))
    .resolves.toMatchObject({ ok: false, errorCode: "rate_limited" })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test tests/auth/rate-limit.test.ts tests/shares/service.test.ts tests/lockers/service.test.ts`
Expected: FAIL because the helpers, injected limiter parameters, and typed errors do not exist.

- [ ] **Step 3: Implement the magic-link limiter**

Create `lib/auth/rate-limit.ts` with the signature above. Normalize the email with `trim().toLowerCase()`. Check `auth:email:<email>` at 5 per 10 minutes, then `auth:ip:<ip>` at 20 per 10 minutes. Return `false` on either failure.

In `app/auth/actions.ts`, read the first `x-forwarded-for` entry (fall back to `"unknown"`), call the helper, and on failure `redirect("/auth/check-email")`. Keep the existing Zod email validation. Do not reveal allowlist membership in the response.

- [ ] **Step 4: Rate-limit and cap share creation**

In `lib/shares/service.ts`:

- Add `ShareLimitError extends Error` with `code: "rate_limited" | "share_limit_reached"`.
- Add `limiter?: RateLimiter` and `now?: Date` to `CreateShareInput`.
- Check `share:create:user:<userId>` at 10 per hour before creating.
- Count live grants with `revokedAt: null` and `expiresAt > now`; if `>= 20`, throw `share_limit_reached`.
- Keep the existing duration/uses validation and locker ownership check.

In `app/actions/shares.ts`, change `createShare` to return the `CreateShareResult` union. Catch `ShareLimitError` and map its code; catch other errors as `"invalid_input"`.

In `components/share-dialog.tsx`, update `handleSubmit` to branch on `result.ok` and set the created URL from `result.url`. Map `rate_limited` to `Too many links. Try again later.`, `share_limit_reached` to `This locker has too many active links. Revoke one first.`, and `invalid_input` to the existing generic message.

- [ ] **Step 5: Rate-limit owner commands**

In `lib/lockers/service.ts`:

- Add `limiter?: RateLimiter` to `LockerActionInput`.
- At the start of `runLockCommand`, check `lock:user:<userId>` at 30 per minute. Return `{ ok: false, errorCode: "rate_limited" }` without calling the provider or writing an event.
- Keep the existing authorization and failure path unchanged.

In `components/locker-card.tsx`, map `rate_limited` to `Too many attempts. Wait a minute and try again.`

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test tests/auth/rate-limit.test.ts tests/shares/service.test.ts tests/lockers/service.test.ts`
Expected: PASS.

- [ ] **Step 7: Update the docs**

- `README.md`: list the magic-link, share-create, owner-command, and guest-redeem limits.
- `docs/pilot-setup-guide.md`: explain that Upstash is required for limits across multiple instances and that the in-memory limiter is per process.

- [ ] **Step 8: Run the full verification**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`
Expected: lint clean, typecheck clean, all tests pass, build passes, and every E2E test passes.

- [ ] **Step 9: Commit**

```bash
git add lib/auth/rate-limit.ts app/auth/actions.ts lib/shares/service.ts app/actions/shares.ts lib/lockers/service.ts app/actions/lockers.ts components/share-dialog.tsx components/locker-card.tsx tests README.md docs/pilot-setup-guide.md
git commit -m "fix: rate-limit auth, share creation, and owner commands"
```
