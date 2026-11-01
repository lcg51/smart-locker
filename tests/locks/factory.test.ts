import { expect, it } from "vitest"
import { createLockProvider } from "@/lib/locks"
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
