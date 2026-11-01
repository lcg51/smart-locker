import { provisionApartment, type ProvisionInput } from "@/lib/ops/provision"

function parseArgs(args: string[]): ProvisionInput {
  let email: string | undefined
  let gatewayId: string | undefined
  const lockers: ProvisionInput["lockers"] = []

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === "--email" || arg === "--gateway" || arg === "--locker") {
      const value = args[index + 1]
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${arg}`)
      }
      index += 1

      if (arg === "--email") {
        email = value
      } else if (arg === "--gateway") {
        gatewayId = value
      } else {
        const [name, vendor, vendorLockId, ...extra] = value.split(":")
        if (!name || !vendor || !vendorLockId || extra.length > 0) {
          throw new Error("Each --locker must use the format name:vendor:vendorLockId")
        }
        lockers.push({ name, vendor, vendorLockId })
      }
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!email || !gatewayId || lockers.length === 0) {
    throw new Error("Usage: pnpm provision --email <email> --gateway <id> --locker <name:vendor:vendorLockId> [--locker ...]")
  }

  return { email, gatewayId, lockers }
}

async function main(): Promise<void> {
  const input = parseArgs(process.argv.slice(2))
  const { userId } = await provisionApartment(input)
  console.log(userId)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
