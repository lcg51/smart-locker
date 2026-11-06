import { expect, it } from "vitest"
import { createLockProvider, getLockProvider } from "@/lib/locks"
import { runLockProviderContract } from "@/tests/locks/contract"

runLockProviderContract("createLockProvider mock", () => createLockProvider({ LOCK_PROVIDER: "mock" }), {
  strictUnknown: false,
})

it("uses lenient mode by default for seeded lock ids", async () => {
  const provider = await createLockProvider({ LOCK_PROVIDER: "mock" })

  await expect(provider.unlock("lock-1")).resolves.toEqual({ success: true })
})

it("rejects TTLock until its provider is implemented", async () => {
  await expect(createLockProvider({ LOCK_PROVIDER: "ttlock" })).rejects.toThrow(
    "ttlock provider is not configured yet",
  )
})

it("reuses one provider per process so mock lock state survives across requests", async () => {
  const first = await getLockProvider()
  const second = await getLockProvider()

  expect(second).toBe(first)
  const { vendorLockId } = await first.provision({ name: "Shared" })
  await first.unlock(vendorLockId)
  await expect(second.getState(vendorLockId)).resolves.toMatchObject({ status: "unlocked" })
})
