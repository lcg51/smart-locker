import { describe, expect, it, vi } from "vitest"
import { QuotaExceededError } from "@/lib/locks/quota"
import { TTLockProvider } from "@/lib/locks/ttlock"

function fakeClient(overrides: { post?: () => Promise<unknown>; get?: () => Promise<unknown> } = {}) {
  return {
    post: vi.fn(overrides.post ?? (async () => ({ errcode: 0 }))),
    get: vi.fn(overrides.get ?? (async () => ({ errcode: 0, state: 0 }))),
  }
}

describe("TTLockProvider", () => {
  it("maps a successful unlock response", async () => {
    const client = fakeClient()
    await expect(new TTLockProvider(client).unlock("42")).resolves.toEqual({ success: true })
    expect(client.post).toHaveBeenCalledWith("/v3/lock/unlock", { lockId: 42 }, "command")
  })

  it("maps a successful lock response", async () => {
    const client = fakeClient()
    await expect(new TTLockProvider(client).lock("42")).resolves.toEqual({ success: true })
    expect(client.post).toHaveBeenCalledWith("/v3/lock/lock", { lockId: 42 }, "command")
  })

  it("maps a vendor error to an error code", async () => {
    const client = fakeClient({ post: async () => ({ errcode: 30003, errmsg: "locked" }) })
    await expect(new TTLockProvider(client).unlock("42")).resolves.toEqual({ success: false, errorCode: "30003" })
  })

  it("returns a failure instead of throwing on network errors", async () => {
    const client = fakeClient({ post: async () => { throw new Error("timeout") } })
    await expect(new TTLockProvider(client).unlock("42")).resolves.toEqual({ success: false, errorCode: "network_error" })
  })

  it("rejects a lock id that is not numeric without calling the vendor", async () => {
    const client = fakeClient()
    await expect(new TTLockProvider(client).unlock("not-a-number")).resolves.toEqual({
      success: false,
      errorCode: "unknown_lock",
    })
    expect(client.post).not.toHaveBeenCalled()
  })

  it("maps the queried open state", async () => {
    const client = fakeClient({ get: async () => ({ errcode: 0, state: 1 }) })
    await expect(new TTLockProvider(client).getState("42")).resolves.toEqual({
      status: "unlocked",
      batteryLevel: null,
      online: true,
    })
    expect(client.get).toHaveBeenCalledWith("/v3/lock/queryOpenState", { lockId: 42 }, "state")
  })

  it("reports an unknown state when the lock answers 2", async () => {
    const client = fakeClient({ get: async () => ({ errcode: 0, state: 2 }) })
    await expect(new TTLockProvider(client).getState("42")).resolves.toEqual({
      status: "unknown",
      batteryLevel: null,
      online: true,
    })
  })

  it("reports an unknown offline state instead of guessing when the query fails", async () => {
    const client = fakeClient({ get: async () => ({ errcode: 10004, errmsg: "expired" }) })
    await expect(new TTLockProvider(client).getState("42")).resolves.toEqual({
      status: "unknown",
      batteryLevel: null,
      online: false,
    })
  })

  it("maps a quota pause to a quota error instead of a network error", async () => {
    const client = {
      post: vi.fn(async () => { throw new QuotaExceededError("hard_limited") }),
      get: vi.fn(),
    }
    await expect(new TTLockProvider(client).unlock("42")).resolves.toEqual({
      success: false,
      errorCode: "quota_exceeded",
    })
  })

  it("surfaces a quota pause from a state read", async () => {
    const client = {
      post: vi.fn(),
      get: vi.fn(async () => { throw new QuotaExceededError("soft_limited") }),
    }
    await expect(new TTLockProvider(client).getState("42")).rejects.toBeInstanceOf(QuotaExceededError)
  })

  it("does not provision locks through the API", async () => {
    await expect(new TTLockProvider(fakeClient()).provision({ name: "Kitchen" })).rejects.toThrow(
      "TTLock locks are added in the TTLock app",
    )
  })
})
