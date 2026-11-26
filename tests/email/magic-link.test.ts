import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resolveMagicLinkLocale, sendMagicLinkEmail } from "@/lib/email/magic-link"

const URL = "https://example.com/api/auth/callback/resend?token=abc"

function stubResend(response: { body: unknown; status: number }) {
  let request: { url: string; init?: RequestInit } | undefined
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    request = { url: String(input), init }
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    })
  })
  return () => request
}

function parseBody(init?: RequestInit): { from: string; to: string; subject: string; text: string; html?: string } {
  return JSON.parse(String(init?.body)) as {
    from: string
    to: string
    subject: string
    text: string
    html?: string
  }
}

beforeEach(() => vi.unstubAllGlobals())
afterEach(() => vi.restoreAllMocks())

describe("sendMagicLinkEmail", () => {
  it("sends the sign-in link in English", async () => {
    const getRequest = stubResend({ body: { id: "email_1" }, status: 200 })

    await sendMagicLinkEmail({
      to: "ana@example.com",
      url: URL,
      locale: "en",
    })

    const request = getRequest()
    expect(request?.url).toBe("https://api.resend.com/emails")
    expect(request?.init?.method).toBe("POST")
    expect(new Headers(request?.init?.headers).get("authorization")).toMatch(/^Bearer /)

    const body = parseBody(request?.init)
    expect(body.from).toBe("no-reply@example.com")
    expect(body.to).toBe("ana@example.com")
    expect(body.subject).toBe("Sign in to Smart Locker")
    expect(body.text).toContain(URL)
    expect((body.text.match(/token=abc/g) ?? []).length).toBe(1)
    expect(body.html).toContain("<!doctype html>")
    expect(body.html).toContain('lang="en"')
    expect(body.html).toContain(URL)
    expect(body.text).not.toMatch(/invited|not invited/i)
  })

  it("sends the sign-in link in Spanish", async () => {
    const getRequest = stubResend({ body: { id: "email_2" }, status: 200 })

    await sendMagicLinkEmail({
      to: "ana@example.com",
      url: URL,
      locale: "es",
    })

    const body = parseBody(getRequest()?.init)
    expect(body.to).toBe("ana@example.com")
    expect(body.subject).toBe("Inicia sesión en Smart Locker")
    expect(body.text).toContain(URL)
    expect(body.html).toContain('lang="es"')
    expect(body.text).not.toMatch(/invitad|no está en la lista/i)
  })

  it("throws and logs a constant message when Resend rejects the message", async () => {
    stubResend({ body: { name: "validation_error", message: "Invalid API key" }, status: 401 })
    const logError = vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(sendMagicLinkEmail({
      to: "ana@example.com",
      url: URL,
      locale: "en",
    })).rejects.toThrow("magic_link_email_failed")

    expect(logError).toHaveBeenCalledWith("Magic link email failed")
    expect(logError).not.toHaveBeenCalledWith(expect.stringContaining("ana@example.com"))
    expect(logError).not.toHaveBeenCalledWith(expect.stringContaining("token=abc"))
  })

  it("throws when Resend returns success without a message id", async () => {
    stubResend({ body: {}, status: 200 })
    vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(sendMagicLinkEmail({
      to: "ana@example.com",
      url: URL,
      locale: "en",
    })).rejects.toThrow("magic_link_email_failed")
  })

  it("propagates a network failure as a delivery failure", async () => {
    vi.stubGlobal("fetch", async () => { throw new Error("network unavailable") })
    vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(sendMagicLinkEmail({
      to: "ana@example.com",
      url: URL,
      locale: "en",
    })).rejects.toThrow("magic_link_email_failed")
  })
})

describe("resolveMagicLinkLocale", () => {
  it("uses the request locale", async () => {
    await expect(resolveMagicLinkLocale(async () => "es")).resolves.toBe("es")
  })

  it("falls back to English when the lookup fails", async () => {
    await expect(resolveMagicLinkLocale(async () => {
      throw new Error("no request context")
    })).resolves.toBe("en")
  })
})
