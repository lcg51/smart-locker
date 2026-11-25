# Task 39: Branded magic-link email

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Pilot hardening and growth design](../../specs/2026-11-03-smart-locker-pilot-hardening-design.md) §23.
> Phase 3 (polish). **Depends on:** Task 27, Task 36.

---

**Files:**
- Create: `lib/email/magic-link-template.ts`
- Test: `tests/email/magic-link-template.test.ts`
- Modify: `lib/email/magic-link.ts`
- Modify: `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/es.ts`
- Modify: `tests/email/magic-link.test.ts`
- Modify: `docs/pilot-setup-guide.md`

**Interfaces:**
- Consumes: `Locale`, the `email` dictionary group, `fill()`.
- Produces:
  - `renderMagicLinkEmail({ url, locale }): { subject, html, text }`
  - `escapeHtml(value: string): string`
  - `sendMagicLinkEmail` sends both `html` and `text` while keeping its current signature.

**Non-goals:** No guest-unlock email restyle, no images or logos, no tracking
pixels, no external fonts, no external CSS, no new email dependency (no React
Email), no marketing content, and no change to the token, callback URL, subject,
or provider.

- [ ] **Step 1: Write the failing template tests**

Create `tests/email/magic-link-template.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { escapeHtml, renderMagicLinkEmail } from "@/lib/email/magic-link-template"

const URL = "https://example.com/api/auth/callback/resend?token=abc&email=ana%40example.com"

describe("escapeHtml", () => {
  it("escapes the characters that break HTML attributes", () => {
    expect(escapeHtml(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &#39;")
  })
})

describe("renderMagicLinkEmail", () => {
  it("renders an accessible English HTML email and a plain-text fallback", () => {
    const { subject, html, text } = renderMagicLinkEmail({ url: URL, locale: "en" })

    expect(subject).toBe("Sign in to Smart Locker")
    expect(html).toContain("<!doctype html>")
    expect(html).toContain('lang="en"')
    expect(html).toContain('name="color-scheme"')
    expect(html).toContain('role="presentation"')
    expect(html).toContain("Sign in to Smart Locker")
    expect(html).toContain('href="https://example.com/api/auth/callback/resend?token=abc&amp;email=ana%40example.com"')
    expect(html).toContain("style=")
    expect(html).not.toContain("<img")
    expect(html).not.toContain("<script")
    expect(html).not.toContain("src=")
    expect(text).toContain(URL)
    expect(text).not.toContain("<")
  })

  it("renders Spanish copy", () => {
    const { subject, html, text } = renderMagicLinkEmail({ url: URL, locale: "es" })

    expect(subject).toBe("Inicia sesión en Smart Locker")
    expect(html).toContain('lang="es"')
    expect(html).toContain("Inicia sesión en Smart Locker")
    expect(html).toContain("Iniciar sesión")
    expect(text).toContain(URL)
  })

  it("contains the sign-in URL once in the text part", () => {
    const { text } = renderMagicLinkEmail({ url: URL, locale: "en" })
    expect((text.match(/token=abc/g) ?? []).length).toBe(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/email/magic-link-template.test.ts`

Expected: FAIL because `@/lib/email/magic-link-template` does not exist.

- [ ] **Step 3: Add the localized copy**

Add to `email` in both dictionaries:

English:

```ts
signInHeading: "Sign in to Smart Locker",
signInIntro: "Use the button below to sign in. This link expires in 24 hours.",
signInButton: "Sign in",
signInFallback: "If the button doesn’t work, copy and paste this link:",
signInIgnore: "If you didn’t request this email, you can ignore it.",
```

Spanish:

```ts
signInHeading: "Inicia sesión en Smart Locker",
signInIntro: "Usa el botón de abajo para iniciar sesión. El enlace caduca en 24 horas.",
signInButton: "Iniciar sesión",
signInFallback: "Si el botón no funciona, copia y pega este enlace:",
signInIgnore: "Si no solicitaste este correo, puedes ignorarlo.",
```

Keep `signInSubject` and `signInBody`; the text part continues to use
`signInBody` so the existing sender test remains valid.

- [ ] **Step 4: Implement the template**

Create `lib/email/magic-link-template.ts` with `escapeHtml` and a table-based
HTML template. Use inline styles as the source of truth, a 600px card, a system
font stack, a dark-mode `<style>` block, and no external resources. Skeleton:

```ts
import type { Locale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { fill } from "@/lib/i18n/format"

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function renderMagicLinkEmail({
  url,
  locale,
}: {
  url: string
  locale: Locale
}): { subject: string; html: string; text: string } {
  const dictionary = getDictionary(locale)
  const email = dictionary.email
  const href = escapeHtml(url)
  const text = fill(email.signInBody, { url })

  const html = `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(email.signInSubject)}</title>
<style>
@media (prefers-color-scheme: dark) {
  .email-body { background-color: #0b0f19 !important; }
  .email-card { background-color: #111827 !important; border-color: #374151 !important; }
  .email-text { color: #e5e7eb !important; }
  .email-muted { color: #9ca3af !important; }
  .email-button { background-color: #f9fafb !important; color: #111827 !important; }
}
</style>
</head>
<body class="email-body" style="margin:0;padding:0;background-color:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" class="email-card" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
          <tr>
            <td style="padding:32px;">
              <p class="email-muted" style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.4;font-weight:600;color:#6b7280;">Smart Locker</p>
              <h1 class="email-text" style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:24px;line-height:1.3;font-weight:600;color:#111827;">${escapeHtml(email.signInHeading)}</h1>
              <p class="email-text" style="margin:0 0 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#374151;">${escapeHtml(email.signInIntro)}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center" bgcolor="#111827" style="border-radius:8px;">
                    <a class="email-button" href="${href}" style="display:inline-block;padding:14px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.2;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(email.signInButton)}</a>
                  </td>
                </tr>
              </table>
              <p class="email-muted" style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#6b7280;">${escapeHtml(email.signInFallback)}</p>
              <p style="margin:0 0 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;word-break:break-all;"><a href="${href}" style="color:#374151;">${href}</a></p>
              <p class="email-muted" style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#6b7280;">${escapeHtml(email.signInIgnore)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject: email.signInSubject, html, text }
}
```

Run: `pnpm test tests/email/magic-link-template.test.ts`

Expected: PASS. If a string assertion fails because of formatting, keep the
markup and adjust the assertion; do not remove inline styles, escaping, or the
text part.

- [ ] **Step 5: Send both parts**

In `lib/email/magic-link.ts`, replace the direct subject/text construction with
the renderer:

```ts
const { subject, html, text } = renderMagicLinkEmail({ url: input.url, locale: input.locale })
const response = await resend.emails.send({
  from: env.EMAIL_FROM,
  to: input.to,
  subject,
  html,
  text,
})
```

Keep the constant log message and thrown `magic_link_email_failed` error.

- [ ] **Step 6: Update the sender test**

In `tests/email/magic-link.test.ts`, assert that the Resend payload includes an
`html` part with the sign-in URL and a `text` part, and that the subject is
unchanged. The existing envelope, auth-header, URL-count, and log-hygiene
assertions must stay green.

Run: `pnpm test tests/email/magic-link.test.ts tests/email/magic-link-template.test.ts`

Expected: PASS.

- [ ] **Step 7: Manual email-client acceptance**

There is no automated way to prove email rendering. Send one English and one
Spanish sign-in email to a test account and check:

- Gmail web in light and dark mode.
- Apple Mail on macOS and iOS.
- Outlook web; Outlook desktop if available.
- A 320px-wide phone viewport and 200% zoom.
- Images are not required (the template has none).
- The button works, and the fallback link works.
- A text-only client shows the URL.
- VoiceOver reads the heading, intro, button, and fallback in order.

Update `docs/pilot-setup-guide.md` resident acceptance step 1 with a line asking
the operator to confirm the email's button, fallback link, and readability in
light and dark mode.

- [ ] **Step 8: Run the full verification**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`

Expected: lint clean, typecheck clean, all unit tests pass, build passes, and
every E2E test passes.

- [ ] **Step 9: Commit**

```bash
git add lib/email tests/email lib/i18n/dictionaries docs/pilot-setup-guide.md
git commit -m "feat: brand the magic-link email"
```

---

## Review focus

- The HTML must contain no external resources, images, tracking pixels, or
  scripts; the button and fallback link are the only sign-in affordances.
- The URL is escaped in both `href` and visible text; the plain-text part keeps
  the raw URL and never contains markup.
- The email stays neutral about invite status and never includes the recipient.
- Inline styles are the source of truth; the dark-mode block is progressive
  enhancement, not the only styling.
- The subject and token flow stay unchanged.
