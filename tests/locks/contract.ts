import { describe, expect, it } from "vitest"
import type { LockProvider } from "@/lib/locks/types"

export function runLockProviderContract(
  name: string,
  create: () => LockProvider | Promise<LockProvider>,
  options: { strictUnknown?: boolean } = {},
) {
  describe(`${name} contract`, () => {
    it("provisions a lock and reports it locked and online", async () => {
      const provider = await create()
      const { vendorLockId } = await provider.provision({ name: "Kitchen" })
      expect(vendorLockId).toBeTruthy()
      await expect(provider.getState(vendorLockId)).resolves.toMatchObject({ status: "locked", online: true })
    })

    it("unlocks and locks a provisioned lock", async () => {
      const provider = await create()
      const { vendorLockId } = await provider.provision({ name: "Kitchen" })
      await expect(provider.unlock(vendorLockId)).resolves.toEqual({ success: true })
      await expect(provider.getState(vendorLockId)).resolves.toMatchObject({ status: "unlocked" })
      await expect(provider.lock(vendorLockId)).resolves.toEqual({ success: true })
      await expect(provider.getState(vendorLockId)).resolves.toMatchObject({ status: "locked" })
    })

    if (options.strictUnknown ?? true) {
      it("fails an unknown lock without throwing", async () => {
        const provider = await create()
        await expect(provider.unlock("missing")).resolves.toEqual({ success: false, errorCode: "unknown_lock" })
      })
    }
  })
}
