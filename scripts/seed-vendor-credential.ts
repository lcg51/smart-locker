import { encryptSecret } from "@/lib/crypto"
import { prisma } from "@/lib/db"
import { requestTTLockToken } from "@/lib/locks/ttlock"

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

async function main(): Promise<void> {
  const key = required("CREDENTIAL_ENCRYPTION_KEY")
  const token = await requestTTLockToken({
    baseUrl: required("TTLOCK_API_URL"),
    clientId: required("TTLOCK_CLIENT_ID"),
    clientSecret: required("TTLOCK_CLIENT_SECRET"),
    username: required("TTLOCK_MAIL"),
    password: required("TTLOCK_PASSWORD"),
  })

  const encryptedTokens = encryptSecret(JSON.stringify(token), key)
  await prisma.vendorCredential.upsert({
    where: { vendor: "ttlock" },
    create: { vendor: "ttlock", encryptedTokens },
    update: { encryptedTokens },
  })

  console.log(`TTLock credential stored. Token expires ${token.expiresAt}; re-run this script before then.`)
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
