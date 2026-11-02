import { execFileSync } from "node:child_process"
import { prisma } from "../lib/db"
import { provisionApartment } from "../lib/ops/provision"

export default async function globalSetup(): Promise<void> {
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

  await prisma.user.update({
    where: { id: userId },
    data: { guestUnlockEmails: false },
  })
}
