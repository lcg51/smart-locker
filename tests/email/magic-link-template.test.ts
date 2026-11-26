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
    expect(html).toContain("prefers-color-scheme")
    expect(html).toContain('class="email-shell"')
    expect(html).toContain('class="email-link"')
    expect(html).toContain('role="presentation"')
    expect(html).toContain("Sign in to Smart Locker")
    expect(html).toContain('href="https://example.com/api/auth/callback/resend?token=abc&amp;email=ana%40example.com"')
    expect(html).toContain("style=")
    expect(html).not.toContain("<img")
    expect(html).not.toContain("<script")
    expect(html).not.toContain("src=")
    expect(html).not.toMatch(/<link\b/i)
    expect(html).not.toMatch(/@import/i)
    expect(html).not.toMatch(/url\(/i)
    const escapedUrl = URL.replace(/&/g, "&amp;")
    expect(html).toContain(`>${escapedUrl}<`)
    expect(text).toContain(URL)
    expect(text).not.toContain("<")
  })

  it("renders Spanish copy", () => {
    const { subject, html, text } = renderMagicLinkEmail({ url: URL, locale: "es" })

    expect(subject).toBe("Inicia sesión en Smart Locker")
    expect(html).toContain('lang="es"')
    expect(html).toContain("Inicia sesión en Smart Locker")
    expect(html).toContain("Iniciar sesión")
    expect(html).toContain("Usa el botón de abajo para iniciar sesión")
    expect(html).toContain("Si el botón no funciona")
    expect(html).toContain("Si no solicitaste este correo")
    expect(text).toContain(URL)
  })

  it("contains the sign-in URL once in the text part", () => {
    const { text } = renderMagicLinkEmail({ url: URL, locale: "en" })
    expect((text.match(/token=abc/g) ?? []).length).toBe(1)
  })
})
