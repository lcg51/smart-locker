# Task 01: Tooling, environment validation, and test harness

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Smart Locker MVP — Design](../../specs/2026-11-01-smart-locker-mvp-design.md).
> Phase 1 (mock provider). **Depends on:** —.

---

**Files:**
- Modify: `package.json`, `.gitignore`
- Create: `compose.yaml`, `docker/init.sql`, `.env.example`, `.env.test.example`, `vitest.config.ts`, `tests/setup.ts`, `lib/env.ts`, `tests/env.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseEnv(source: Record<string, string | undefined>): Env`, `getEnv(): Env`, and `Env` with `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, `EMAIL_FROM`, `RESEND_API_KEY`, `LOCK_PROVIDER`, `E2E`, and optional vendor/Upstash fields.

- [ ] **Step 1: Install dependencies**

```bash
pnpm add next-auth@beta @auth/prisma-adapter @prisma/client resend @upstash/ratelimit @upstash/redis
pnpm add -D prisma vitest dotenv-cli tsx @playwright/test msw eslint eslint-config-next @eslint/eslintrc
```

- [ ] **Step 2: Add scripts and ignore rules**

Add to `package.json`:

```json
"test": "dotenv -e .env.test -- vitest run",
"test:watch": "dotenv -e .env.test -- vitest",
"test:e2e": "dotenv -e .env.test -- playwright test",
"typecheck": "tsc --noEmit",
"db:migrate": "prisma migrate dev",
"db:deploy": "prisma migrate deploy",
"db:generate": "prisma generate",
"test:db": "dotenv -e .env.test -- prisma migrate deploy",
"provision": "tsx scripts/provision.ts"
```

Append to `.gitignore`:

```
.env.test
```

- [ ] **Step 3: Add the local database and env templates**

Create `compose.yaml`:

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: smart
      POSTGRES_PASSWORD: smart
      POSTGRES_DB: smart_locker
    ports:
      - "5432:5432"
    volumes:
      - ./docker/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
      - smart-locker-db:/var/lib/postgresql/data

volumes:
  smart-locker-db:
```

Create `docker/init.sql`:

```sql
CREATE DATABASE smart_locker_test;
```

Create `.env.example` and `.env.test.example` with the same keys; the test file uses the `smart_locker_test` database and `E2E=1`:

```
DATABASE_URL=postgresql://smart:smart@localhost:5432/smart_locker
AUTH_SECRET=replace-with-32-or-more-characters
AUTH_URL=http://localhost:3000
APP_URL=http://localhost:3000
EMAIL_FROM=Smart Locker <no-reply@example.com>
RESEND_API_KEY=re_replace_me
LOCK_PROVIDER=mock
E2E=1
```

- [ ] **Step 4: Write the failing env test**

Create `tests/env.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { parseEnv } from "@/lib/env"

const valid = {
  DATABASE_URL: "postgresql://smart:smart@localhost:5432/smart_locker",
  AUTH_SECRET: "a".repeat(32),
  APP_URL: "http://localhost:3000",
  EMAIL_FROM: "no-reply@example.com",
  RESEND_API_KEY: "re_test",
}

describe("parseEnv", () => {
  it("defaults the lock provider to mock", () => {
    expect(parseEnv(valid).LOCK_PROVIDER).toBe("mock")
  })

  it("rejects a short auth secret", () => {
    expect(() => parseEnv({ ...valid, AUTH_SECRET: "short" })).toThrow()
  })

  it("rejects a missing database url", () => {
    const { DATABASE_URL, ...rest } = valid
    expect(() => parseEnv(rest)).toThrow()
  })
})
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `pnpm test tests/env.test.ts`
Expected: FAIL because `@/lib/env` does not exist.

- [ ] **Step 6: Implement `lib/env.ts`**

```ts
import { z } from "zod"

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url().optional(),
  APP_URL: z.string().url(),
  EMAIL_FROM: z.string().email(),
  RESEND_API_KEY: z.string().min(1),
  LOCK_PROVIDER: z.enum(["mock", "ttlock"]).default("mock"),
  TTLOCK_API_BASE: z.string().url().optional(),
  TTLOCK_ACCESS_TOKEN: z.string().optional(),
  CREDENTIAL_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  E2E: z.enum(["1"]).optional(),
})

export type Env = z.infer<typeof envSchema>

export function parseEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(source)
}

let cached: Env | null = null

export function getEnv(): Env {
  cached ??= parseEnv(process.env)
  return cached
}
```

- [ ] **Step 7: Add the Vitest config and setup file**

Create `vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const root = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  resolve: { alias: { "@": root } },
  test: {
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    fileParallelism: false,
  },
})
```

Create `tests/setup.ts`:

```ts
import { webcrypto } from "node:crypto"

process.env.TZ = "UTC"
if (!globalThis.crypto) globalThis.crypto = webcrypto as Crypto
```

- [ ] **Step 8: Start the database and verify the test passes**

Run: `cp .env.test.example .env.test && docker compose up -d db && pnpm test tests/env.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml .gitignore compose.yaml docker/init.sql .env.example .env.test.example vitest.config.ts tests/setup.ts lib/env.ts tests/env.test.ts
git commit -m "chore: add env validation, local postgres, and vitest"
```
