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
