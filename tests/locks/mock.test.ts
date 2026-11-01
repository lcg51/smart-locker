import { MockLockProvider } from "@/lib/locks/mock"
import { runLockProviderContract } from "@/tests/locks/contract"
import { describe, expect, it } from "vitest"

runLockProviderContract("MockLockProvider", () => new MockLockProvider({ strictUnknown: true }))

describe("MockLockProvider options", () => {
  it("auto-registers unknown locks by default", async () => {
    const provider = new MockLockProvider()

    await expect(provider.unlock("lock-1")).resolves.toEqual({ success: true })
    await expect(provider.getState("lock-1")).resolves.toMatchObject({ status: "unlocked", online: true })
  })

  it("reports unseen locks as unknown and offline without registering them", async () => {
    const provider = new MockLockProvider({ strictUnknown: true })

    await expect(provider.getState("missing")).resolves.toEqual({
      status: "unknown",
      batteryLevel: null,
      online: false,
    })
    await expect(provider.unlock("missing")).resolves.toEqual({ success: false, errorCode: "unknown_lock" })
  })

  it("fails only the next unlock when configured", async () => {
    const provider = new MockLockProvider({ failNextUnlock: true })
    const { vendorLockId } = await provider.provision({ name: "Kitchen" })

    await expect(provider.unlock(vendorLockId)).resolves.toEqual({ success: false, errorCode: "mock_failure" })
    await expect(provider.getState(vendorLockId)).resolves.toMatchObject({ status: "locked" })
    await expect(provider.unlock(vendorLockId)).resolves.toEqual({ success: true })
  })
})
