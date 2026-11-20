import { execFileSync } from "node:child_process"
import { prisma } from "../lib/db"
import { provisionApartment } from "../lib/ops/provision"
import { assertTestDatabaseUrl } from "../lib/test-db-guard"

export default async function globalSetup(): Promise<void> {
  assertTestDatabaseUrl(process.env.DATABASE_URL)

  execFileSync(
    "pnpm",
    ["exec", "dotenv", "-e", ".env.test", "--", "prisma", "migrate", "reset", "--force", "--skip-seed"],
    { stdio: "inherit" },
  )

  const { userId } = await provisionApartment({
    email: "ana@example.com",
    gatewayId: "gw-e2e",
    lockers: [{ name: "Kitchen", vendor: "mock", vendorLockId: "e2e-lock-1" }],
  })

  await provisionApartment({
    email: "toast@example.com",
    gatewayId: "gw-toast",
    lockers: [{ name: "Toast locker", vendor: "mock", vendorLockId: "toast-lock-1" }],
  })

  const beto = await provisionApartment({
    email: "beto@example.com",
    gatewayId: "gw-beto",
    lockers: [{ name: "Balcony", vendor: "mock", vendorLockId: "beto-lock-1" }],
  })
  await prisma.locker.updateMany({
    where: { userId: beto.userId },
    data: { confirmedAt: new Date() },
  })

  await prisma.user.update({
    where: { id: userId },
    data: { guestUnlockEmails: false },
  })
}
