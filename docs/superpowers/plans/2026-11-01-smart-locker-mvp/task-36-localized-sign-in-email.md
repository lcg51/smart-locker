# Task 36: Localized magic-link sign-in email

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Pilot hardening and growth design](../../specs/2026-11-03-smart-locker-pilot-hardening-design.md) §20.
> Phase 3. **Depends on:** Task 04, Task 27.

---

**Files:**
- Create: `lib/email/magic-link.ts`
- Test: `tests/email/magic-link.test.ts`
- Modify: `auth.ts`
- Modify: `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/es.ts`

**Interfaces:**
- Consumes: `getEnv()`, `getLocale()`, `getDictionary()`, `fill()`, the Resend API.
- Produces:
  - `sendMagicLinkEmail({ to, url, locale }): Promise<void>`; throws on provider failure.
  - `dictionary.email.signInSubject` and `dictionary.email.signInBody` with a `{url}` placeholder.

**Non-goals:** No branding redesign, no HTML template, no per-user sign-in
email preference, no change to the token or callback URL, and no disclosure of
whether an address is invited.

- [ ] **Step 1: Add the dictionary copy**

English:

```ts
signInSubject: "Sign in to Smart Locker",
signInBody:
  "Open this link to sign in to Smart Locker:\n\n{url}\n\nIf you didn’t request this email, you can ignore it. The link expires in 24 hours.",
```

Spanish:

```ts
signInSubject: "Inicia sesión en Smart Locker",
signInBody:
  "Abre este enlace para iniciar sesión en Smart Locker:\n\n{url}\n\nSi no solicitaste este correo, puedes ignorarlo. El enlace caduca en 24 horas.",
```

The copy must not say "invited", "account exists", or anything else that reveals
allowlist status.

- [ ] **Step 2: Write the failing email test**

Create `tests/email/magic-link.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { sendMagicLinkEmail } from "@/lib/email/magic-link"

function stubResend(response: { body: unknown; status: number }) {
  let requestInit: RequestInit | undefined
  vi.stubGlobal("fetch", async (_input: RequestInfo | URL, init?: RequestInit) => {
    requestInit = init
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    })
  })
  return () => requestInit
}

beforeEach(() => vi.unstubAllGlobals())
afterEach(() => vi.restoreAllMocks())

describe("sendMagicLinkEmail", () => {
  it("sends the sign-in link in English", async () => {
    const getRequest = stubResend({ body: { id: "email_1" }, status: 200 })

    await sendMagicLinkEmail({
      to: "ana@example.com",
      url: "https://example.com/api/auth/callback/resend?token=abc",
      locale: "en",
    })

    const body = JSON.parse(String(getRequest()?.body)) as { subject: string; text: string }
    expect(body.subject).toBe("Sign in to Smart Locker")
    expect(body.text).toContain("https://example.com/api/auth/callback/resend?token=abc")
    expect(body.text).not.toMatch(/invited|not invited/i)
  })

  it("sends the sign-in link in Spanish", async () => {
    const getRequest = stubResend({ body: { id: "email_2" }, status: 200 })

    await sendMagicLinkEmail({
      to: "ana@example.com",
      url: "https://example.com/api/auth/callback/resend?token=abc",
      locale: "es",
    })

    const body = JSON.parse(String(getRequest()?.body)) as { subject: string; text: string }
    expect(body.subject).toBe("Inicia sesión en Smart Locker")
    expect(body.text).toContain("https://example.com/api/auth/callback/resend?token=abc")
    expect(body.text).not.toMatch(/invitad|no está en la lista/i)
  })

  it("throws when Resend rejects the message", async () => {
    stubResend({ body: { name: "validation_error", message: "Invalid API key" }, status: 401 })
    vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(sendMagicLinkEmail({
      to: "ana@example.com",
      url: "https://example.com/api/auth/callback/resend?token=abc",
      locale: "en",
    })).rejects.toThrow("magic_link_email_failed")
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test tests/email/magic-link.test.ts`

Expected: FAIL because `@/lib/email/magic-link` does not exist.

- [ ] **Step 4: Implement the sender**

Create `lib/email/magic-link.ts`:

```ts
import { Resend } from "resend"
import { getEnv } from "@/lib/env"
import type { Locale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { fill } from "@/lib/i18n/format"

export type MagicLinkEmailInput = {
  to: string
  url: string
  locale: Locale
}

export async function sendMagicLinkEmail(input: MagicLinkEmailInput): Promise<void> {
  const env = getEnv()
  const dictionary = getDictionary(input.locale)
  const resend = new Resend(env.RESEND_API_KEY)
  const response = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: input.to,
    subject: dictionary.email.signInSubject,
    text: fill(dictionary.email.signInBody, { url: input.url }),
  })

  if (response.error || !response.data?.id) {
    // Do not log the recipient or the sign-in URL.
    throw new Error("magic_link_email_failed")
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test tests/email/magic-link.test.ts`

Expected: PASS.

- [ ] **Step 6: Wire the Resend provider**

In `auth.ts`, replace the provider with an override:

```ts
import type { Locale } from "@/lib/i18n/config"
import { sendMagicLinkEmail } from "@/lib/email/magic-link"
import { getLocale } from "@/lib/i18n/server"

providers: [
  Resend({
    from: env.EMAIL_FROM,
    apiKey: env.RESEND_API_KEY,
    async sendVerificationRequest({ identifier, url }) {
      let locale: Locale = "en"
      try {
        locale = await getLocale()
      } catch {
        // A non-request context falls back to English.
      }
      await sendMagicLinkEmail({ to: identifier, url, locale })
    },
  }),
],
```

`sendVerificationRequest` must let a send failure throw; Auth.js then shows the
generic auth error instead of claiming the link was sent.

- [ ] **Step 7: Run the full verification**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`

Expected: all green. No E2E can read the email, so the sender unit test and the
provider wiring are the evidence for this task.

- [ ] **Step 8: Commit**

```bash
git add auth.ts lib/email tests/email lib/i18n/dictionaries
git commit -m "feat: localize the magic-link sign-in email"
```

---

## Review focus

- The email must stay neutral about allowlist status; only the recipient sees it.
- The sign-in URL must appear exactly once and never be logged on failure.
- A provider failure must surface as a failed send, not a silent success.
