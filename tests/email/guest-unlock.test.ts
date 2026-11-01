import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/db"
import { sendGuestUnlockEmail } from "@/lib/email"
import { MockLockProvider } from "@/lib/locks/mock"
import { provisionApartment } from "@/lib/ops/provision"
import { createShareGrant } from "@/lib/shares/service"
import { redeemShareToken } from "@/lib/shares/redeem"
import { resetDb } from "@/tests/helpers/db"

beforeEach(resetDb)
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function seed() {
  const { userId } = await provisionApartment({
    email: "ana@example.com",
    gatewayId: "gw-email",
    lockers: [{ name: "Kitchen", vendor: "mock", vendorLockId: "lock-email" }],
  })
  const locker = await prisma.locker.findFirstOrThrow({ where: { userId } })
  return { userId, locker }
}

function stubResend(response: { body: unknown; status: number }) {
  let requestUrl = ""
  let requestInit: RequestInit | undefined
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    requestUrl = String(input)
    requestInit = init
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    })
  })
  return () => ({ requestUrl, requestInit })
}

describe("sendGuestUnlockEmail", () => {
  it("sends the locker, guest label, and unlock time through Resend", async () => {
    const getRequest = stubResend({ body: { id: "email_123" }, status: 200 })

    await expect(sendGuestUnlockEmail({
      to: "owner@example.com",
      lockerName: "Kitchen",
      guestLabel: "Cleaner",
      unlockedAt: new Date("2025-04-05T06:07:08.000Z"),
    })).resolves.toBe(true)

    const { requestUrl, requestInit } = getRequest()
    expect(requestUrl).toBe("https://api.resend.com/emails")
    expect(requestInit?.method).toBe("POST")
    const body = JSON.parse(String(requestInit?.body)) as { from: string; to: string[]; subject: string; text: string }
    expect(body.from).toBe("no-reply@example.com")
    expect(body.to).toBe("owner@example.com")
    expect(body.subject).toBe("Kitchen was unlocked")
    expect(body.text).toContain("Cleaner")
    expect(body.text).toContain("Kitchen")
    expect(body.text).toContain("2025")
  })

  it("returns false and logs a provider error without exposing email details", async () => {
    stubResend({
      body: { name: "validation_error", message: "Invalid API key" },
      status: 401,
    })
    const logError = vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(sendGuestUnlockEmail({
      to: "private@example.com",
      lockerName: "Kitchen",
      guestLabel: null,
      unlockedAt: new Date("2025-04-05T06:07:08.000Z"),
    })).resolves.toBe(false)

    expect(logError).toHaveBeenCalledWith("Guest unlock notification failed")
    expect(logError).not.toHaveBeenCalledWith(expect.stringContaining("private@example.com"))
  })

  it("catches a network failure and reports false", async () => {
    vi.stubGlobal("fetch", async () => { throw new Error("network unavailable") })
    vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(sendGuestUnlockEmail({
      to: "owner@example.com",
      lockerName: "Kitchen",
      guestLabel: null,
      unlockedAt: new Date("2025-04-05T06:07:08.000Z"),
    })).resolves.toBe(false)
  })
})

describe("guest unlock email integration", () => {
  it("sends the notification after a successful unlock by default", async () => {
    const { userId, locker } = await seed()
    const { token } = await createShareGrant({ userId, lockerId: locker.id, guestLabel: "Ana" })
    const getRequest = stubResend({ body: { id: "email_456" }, status: 200 })

    await expect(redeemShareToken({
      token,
      ip: "192.0.2.10",
      provider: new MockLockProvider(),
      limiter: { async check() { return true } },
    })).resolves.toEqual({ ok: true })

    const body = JSON.parse(String(getRequest().requestInit?.body)) as { to: string[]; subject: string; text: string }
    expect(body.to).toBe("ana@example.com")
    expect(body.subject).toBe("Kitchen was unlocked")
    expect(body.text).toContain("Ana")
    expect(await prisma.lockEvent.count({ where: { lockerId: locker.id, success: true } })).toBe(1)
  })

  it("does not send if the owner has disabled guest unlock emails", async () => {
    const { userId, locker } = await seed()
    const { token } = await createShareGrant({ userId, lockerId: locker.id })
    await prisma.user.update({ where: { id: userId }, data: { guestUnlockEmails: false } })
    let requests = 0
    vi.stubGlobal("fetch", async () => {
      requests += 1
      return new Response(JSON.stringify({ id: "unexpected" }), { status: 200 })
    })

    await expect(redeemShareToken({
      token,
      ip: "192.0.2.11",
      provider: new MockLockProvider(),
      limiter: { async check() { return true } },
    })).resolves.toEqual({ ok: true })

    expect(requests).toBe(0)
  })

  it("logs a Resend failure once and keeps the unlock successful", async () => {
    const { userId, locker } = await seed()
    const { token } = await createShareGrant({ userId, lockerId: locker.id })
    stubResend({ body: { name: "validation_error", message: "Invalid API key" }, status: 401 })
    const logError = vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(redeemShareToken({
      token,
      ip: "192.0.2.12",
      provider: new MockLockProvider(),
      limiter: { async check() { return true } },
    })).resolves.toEqual({ ok: true })

    expect(logError).toHaveBeenCalledTimes(1)
    expect(await prisma.lockEvent.count({ where: { lockerId: locker.id, success: true } })).toBe(1)
  })
})
