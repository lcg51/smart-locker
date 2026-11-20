import { expect, it } from "vitest"
import { encryptSecret } from "@/lib/crypto"
import { prisma } from "@/lib/db"
import { createLockProvider, getLockProvider } from "@/lib/locks"
import { TTLockProvider } from "@/lib/locks/ttlock"
import { runLockProviderContract } from "@/tests/locks/contract"

runLockProviderContract("createLockProvider mock", () => createLockProvider({ LOCK_PROVIDER: "mock" }), {
  strictUnknown: false,
})

it("uses lenient mode by default for seeded lock ids", async () => {
  const provider = await createLockProvider({ LOCK_PROVIDER: "mock" })

  await expect(provider.unlock("lock-1")).resolves.toEqual({ success: true })
})

it("rejects TTLock without an encryption key", async () => {
  await expect(createLockProvider({ LOCK_PROVIDER: "ttlock" })).rejects.toThrow(
    "CREDENTIAL_ENCRYPTION_KEY is required",
  )
})

it("rejects TTLock when no credential has been seeded", async () => {
  await expect(
    createLockProvider({
      LOCK_PROVIDER: "ttlock",
      TTLOCK_API_URL: "https://euapi.ttlock.com",
      TTLOCK_CLIENT_ID: "client-1",
      CREDENTIAL_ENCRYPTION_KEY: "a".repeat(64),
    }),
  ).rejects.toThrow("pnpm seed-ttlock")
})

it("builds a TTLock provider from the stored encrypted token", async () => {
  const key = "a".repeat(64)
  await prisma.vendorCredential.create({
    data: {
      vendor: "ttlock",
      encryptedTokens: encryptSecret(JSON.stringify({ accessToken: "access-1" }), key),
    },
  })

  const provider = await createLockProvider({
    LOCK_PROVIDER: "ttlock",
    TTLOCK_API_URL: "https://euapi.ttlock.com",
    TTLOCK_CLIENT_ID: "client-1",
    CREDENTIAL_ENCRYPTION_KEY: key,
  })

  expect(provider).toBeInstanceOf(TTLockProvider)
})

it("reuses one provider per process so mock lock state survives across requests", async () => {
  const first = await getLockProvider()
  const second = await getLockProvider()

  expect(second).toBe(first)
  const { vendorLockId } = await first.provision({ name: "Shared" })
  await first.unlock(vendorLockId)
  await expect(second.getState(vendorLockId)).resolves.toMatchObject({ status: "unlocked" })
})
