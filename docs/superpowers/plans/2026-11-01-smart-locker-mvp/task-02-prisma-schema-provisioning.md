# Task 02: Prisma schema, migration, and ops provisioning

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Smart Locker MVP — Design](../../specs/2026-11-01-smart-locker-mvp-design.md).
> Phase 1 (mock provider). **Depends on:** Task 01.

---

**Files:**
- Create: `prisma/schema.prisma`, `lib/db.ts`, `lib/ops/provision.ts`, `scripts/provision.ts`, `tests/helpers/db.ts`, `tests/ops/provision.test.ts`

**Interfaces:**
- Consumes: `getEnv()` from Task 1.
- Produces: `prisma` client; `resetDb(): Promise<void>`; `provisionApartment(input: ProvisionInput): Promise<{ userId: string }>` where `ProvisionInput = { email: string; gatewayId: string; lockers: Array<{ name: string; vendor: string; vendorLockId: string }> }`.

- [ ] **Step 1: Write the failing provisioning test**

Create `tests/ops/provision.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { provisionApartment } from "@/lib/ops/provision"
import { resetDb } from "@/tests/helpers/db"

beforeEach(resetDb)

describe("provisionApartment", () => {
  it("creates the allowlist entry, user, gateway, and lockers", async () => {
    const { userId } = await provisionApartment({
      email: "Ana@Example.com",
      gatewayId: "gw-1",
      lockers: [{ name: "Kitchen", vendor: "mock", vendorLockId: "lock-1" }],
    })

    expect(await prisma.allowedEmail.findUnique({ where: { email: "ana@example.com" } })).not.toBeNull()
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    expect(user.vendorGatewayId).toBe("gw-1")
    expect(await prisma.locker.count({ where: { userId } })).toBe(1)
  })

  it("is idempotent for the same email and locker", async () => {
    const input = {
      email: "ana@example.com",
      gatewayId: "gw-1",
      lockers: [{ name: "Kitchen", vendor: "mock", vendorLockId: "lock-1" }],
    }
    await provisionApartment(input)
    await provisionApartment(input)

    expect(await prisma.user.count()).toBe(1)
    expect(await prisma.locker.count()).toBe(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/ops/provision.test.ts`
Expected: FAIL because `@/lib/db` and `@/lib/ops/provision` do not exist.

- [ ] **Step 3: Create the Prisma schema**

Create `prisma/schema.prisma` with these models and enums:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                String    @id @default(cuid())
  name              String?
  email             String?   @unique
  emailVerified     DateTime?
  image             String?
  vendorGatewayId   String?
  gatewayLastSeenAt DateTime?
  guestUnlockEmails Boolean   @default(true)
  createdAt         DateTime  @default(now())
  deletedAt         DateTime?
  accounts          Account[]
  sessions          Session[]
  lockers           Locker[]
  shareGrants       ShareGrant[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model AllowedEmail {
  email      String    @id
  invitedBy  String?
  createdAt  DateTime  @default(now())
  acceptedAt DateTime?
}

model Locker {
  id           String      @id @default(cuid())
  userId       String
  user         User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  name         String
  vendor       String
  vendorLockId String
  status       LockStatus  @default(UNKNOWN)
  batteryLevel Int?
  lastSyncedAt DateTime?
  confirmedAt  DateTime?
  createdAt    DateTime    @default(now())
  deletedAt    DateTime?
  shareGrants  ShareGrant[]
  events       LockEvent[]

  @@unique([vendor, vendorLockId])
  @@index([userId])
}

enum LockStatus {
  LOCKED
  UNLOCKED
  UNKNOWN
}

model ShareGrant {
  id              String     @id @default(cuid())
  lockerId        String
  locker          Locker     @relation(fields: [lockerId], references: [id], onDelete: Cascade)
  createdByUserId String
  createdBy       User       @relation(fields: [createdByUserId], references: [id], onDelete: Cascade)
  tokenHash       String     @unique
  guestLabel      String?
  expiresAt       DateTime
  maxUses         Int
  usedCount       Int        @default(0)
  revokedAt       DateTime?
  createdAt       DateTime   @default(now())
  events          LockEvent[]

  @@index([lockerId])
}

model LockEvent {
  id        String     @id @default(cuid())
  lockerId  String
  locker    Locker     @relation(fields: [lockerId], references: [id], onDelete: Cascade)
  grantId   String?
  grant     ShareGrant? @relation(fields: [grantId], references: [id], onDelete: SetNull)
  actorType ActorType
  action    LockAction
  success   Boolean
  errorCode String?
  ipHash    String?
  createdAt DateTime   @default(now())

  @@index([lockerId, createdAt])
}

enum ActorType {
  OWNER
  GUEST
  SYSTEM
}

enum LockAction {
  UNLOCK
  LOCK
}

model VendorCredential {
  id              String   @id @default(cuid())
  vendor          String   @unique
  encryptedTokens String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

- [ ] **Step 4: Generate the client and migrate**

```bash
cp .env.example .env
pnpm db:migrate --name init
cp .env.test.example .env.test
pnpm test:db
```

- [ ] **Step 5: Add the Prisma client and test reset helper**

Create `lib/db.ts`:

```ts
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

Create `tests/helpers/db.ts` with a `resetDb()` that deletes in this order: `lockEvent`, `shareGrant`, `locker`, `session`, `account`, `verificationToken`, `user`, `allowedEmail`, `vendorCredential`.

- [ ] **Step 6: Implement provisioning**

Create `lib/ops/provision.ts` with the `ProvisionInput` interface and `provisionApartment`. Normalize the email to trimmed lowercase, upsert `AllowedEmail`, upsert `User` by email (updating `vendorGatewayId`), then upsert each locker by the `vendor_vendorLockId` compound unique and return `{ userId }`.

Create `scripts/provision.ts` as a thin CLI wrapper: read `--email`, `--gateway`, and repeatable `--locker name:vendor:vendorLockId`, call `provisionApartment`, print the user id, and exit non-zero on bad input.

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm test tests/ops/provision.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add prisma lib/db.ts lib/ops/provision.ts scripts/provision.ts tests/helpers/db.ts tests/ops/provision.test.ts package.json pnpm-lock.yaml
git commit -m "feat: add database schema and apartment provisioning"
```
