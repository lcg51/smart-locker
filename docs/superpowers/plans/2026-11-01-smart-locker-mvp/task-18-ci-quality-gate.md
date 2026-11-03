# Task 18: CI quality gate

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Pilot hardening and growth design](../../specs/2026-11-03-smart-locker-pilot-hardening-design.md).
> Phase 1.5. **Depends on:** Task 13.

---

**Files:**
- Create: `.github/workflows/ci.yml`, `.nvmrc`
- Modify: `package.json` (`packageManager`, `engines`)
- Modify: `README.md`, `docs/pilot-setup-guide.md`

**Interfaces:**
- Consumes: the existing `lint`, `typecheck`, `test`, `build`, `test:db`, and `test:e2e` scripts; the `_test` database guard.
- Produces: required checks on every pull request and on pushes to `dev`; pinned Node and pnpm versions.

**Non-goals:** No deployment workflow, no release automation, no coverage threshold, and no Dependabot/Renovate policy in this task.

**TDD note:** This is a configuration task. There is no product behavior to drive with a unit test; `actionlint` plus the full local gate is the checkable proof.

- [ ] **Step 1: Pin the toolchain**

Create `.nvmrc` with `22`.

In `package.json`, add:

```json
"packageManager": "pnpm@12.16.1",
"engines": { "node": ">=22" }
```

Keep all existing scripts unchanged.

- [ ] **Step 2: Add the workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [dev]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: smart
          POSTGRES_PASSWORD: smart
          POSTGRES_DB: smart_locker_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://smart:smart@localhost:5432/smart_locker_test
      AUTH_SECRET: ci-test-secret-at-least-32-characters-long
      AUTH_URL: http://localhost:3000
      APP_URL: http://localhost:3000
      EMAIL_FROM: no-reply@example.com
      RESEND_API_KEY: re_test_ci
      LOCK_PROVIDER: mock
      RELOCK_SECONDS: "1"
      E2E: "1"
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 12.16.1
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: cp .env.test.example .env.test
      - run: pnpm test:db
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build

  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: smart
          POSTGRES_PASSWORD: smart
          POSTGRES_DB: smart_locker_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://smart:smart@localhost:5432/smart_locker_test
      AUTH_SECRET: ci-test-secret-at-least-32-characters-long
      AUTH_URL: http://localhost:3100
      APP_URL: http://localhost:3100
      EMAIL_FROM: no-reply@example.com
      RESEND_API_KEY: re_test_ci
      LOCK_PROVIDER: mock
      RELOCK_SECONDS: "1"
      E2E: "1"
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 12.16.1
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: cp .env.test.example .env.test
      - run: pnpm test:db
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm test:e2e
```

The exported `DATABASE_URL` must remain the `_test` database; never add a pilot database URL to CI.

- [ ] **Step 3: Validate the workflow**

Run `actionlint .github/workflows/ci.yml` (install it with `brew install actionlint`, or use the `rhysd/actionlint` Docker image in CI).

Expected: no output and exit 0.

- [ ] **Step 4: Run the same gate locally**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`
Expected: all pass. If the local database is not migrated, run `pnpm test:db` first.

- [ ] **Step 5: Document the gate**

- `README.md`: add a short "CI" section listing the required jobs and the Node/pnpm pins.
- `docs/pilot-setup-guide.md`: state that merging to `dev` requires the CI gate and that the E2E job uses only the `_test` database.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/ci.yml .nvmrc package.json README.md docs/pilot-setup-guide.md
git commit -m "chore: add the CI quality gate"
```
