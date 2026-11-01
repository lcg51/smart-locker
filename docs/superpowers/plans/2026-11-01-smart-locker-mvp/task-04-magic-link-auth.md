# Task 04: Auth.js magic-link sign-in with an invite allowlist

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Smart Locker MVP — Design](../../specs/2026-11-01-smart-locker-mvp-design.md).
> Phase 1 (mock provider). **Depends on:** Task 01, Task 02.

---

**Files:**
- Create: `auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `lib/auth/allowlist.ts`, `lib/auth/session.ts`, `app/auth/actions.ts`, `app/auth/page.tsx`, `app/auth/check-email/page.tsx`, `app/auth/error/page.tsx`, `types/next-auth.d.ts`, `tests/auth/allowlist.test.ts`
- Modify: `app/layout.tsx` (keep Toaster and Analytics)
- Delete: `proxy.ts`, `app/page.tsx` (replace with a server redirect)

**Interfaces:**
- Consumes: `prisma`, `getEnv()`, `AllowedEmail`.
- Produces: `handlers`, `auth`, `signIn`, `signOut` from `@/auth`; `isEmailAllowed(email: string): Promise<boolean>`; `requireUser(): Promise<{ id: string; email: string }>`; `requestMagicLink(formData: FormData): Promise<void>`; `logout(): Promise<void>`.

- [ ] **Step 1: Write the failing allowlist test**

Create `tests/auth/allowlist.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { isEmailAllowed } from "@/lib/auth/allowlist"
import { resetDb } from "@/tests/helpers/db"

beforeEach(resetDb)

describe("isEmailAllowed", () => {
  it("accepts an invited email case-insensitively", async () => {
    await prisma.allowedEmail.create({ data: { email: "ana@example.com" } })
    await expect(isEmailAllowed(" Ana@Example.com ")).resolves.toBe(true)
  })

  it("rejects an email that is not on the allowlist", async () => {
    await expect(isEmailAllowed("stranger@example.com")).resolves.toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/auth/allowlist.test.ts`
Expected: FAIL because `@/lib/auth/allowlist` does not exist.

- [ ] **Step 3: Implement the allowlist and session helpers**

Create `lib/auth/allowlist.ts`:

```ts
import { prisma } from "@/lib/db"

export async function isEmailAllowed(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase()
  const allowed = await prisma.allowedEmail.findUnique({ where: { email: normalized } })
  return allowed !== null
}
```

Create `lib/auth/session.ts` with `requireUser()` calling `auth()`, redirecting to `/auth` when there is no session, and redirecting to `/auth/error` when the session user has no email, then returning `{ id, email }`. Add `types/next-auth.d.ts` augmenting `Session.user` with `id: string`.

- [ ] **Step 4: Configure Auth.js**

Create `auth.ts`:

```ts
import NextAuth from "next-auth"
import Resend from "next-auth/providers/resend"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/db"
import { getEnv } from "@/lib/env"
import { isEmailAllowed } from "@/lib/auth/allowlist"

const env = getEnv()

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database", maxAge: 30 * 24 * 60 * 60 },
  providers: [Resend({ from: env.EMAIL_FROM, apiKey: env.RESEND_API_KEY })],
  pages: { signIn: "/auth", verifyRequest: "/auth/check-email", error: "/auth/error" },
  callbacks: {
    async signIn({ user }) {
      return user.email ? isEmailAllowed(user.email) : false
    },
    async session({ session, user }) {
      session.user.id = user.id
      return session
    },
  },
})
```

Create `app/api/auth/[...nextauth]/route.ts` exporting `GET` and `POST` from `handlers`.

- [ ] **Step 5: Add the sign-in pages and actions**

Create `app/auth/actions.ts` with a `"use server"` action that parses `email` with zod and calls `signIn("resend", { email, redirectTo: "/dashboard" })`.

Create `app/auth/page.tsx` as a server component with a form posting to that action. Create `app/auth/check-email/page.tsx` telling the resident to open the link, and `app/auth/error/page.tsx` showing a neutral "this pilot is invite-only" message for `AccessDenied`.

Create `app/page.tsx` as a server component: `const session = await auth(); redirect(session?.user ? "/dashboard" : "/auth")`.

Delete `proxy.ts`.

- [ ] **Step 6: Run the test and typecheck**

Run: `pnpm test tests/auth/allowlist.test.ts && pnpm typecheck`
Expected: PASS and no type errors.

- [ ] **Step 7: Commit**

```bash
git add auth.ts app/api/auth app/auth app/page.tsx lib/auth types/next-auth.d.ts tests/auth
git rm proxy.ts
git commit -m "feat: add magic-link auth with invite allowlist"
```
