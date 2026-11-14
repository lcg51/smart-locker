import { parseArgs } from "node:util"
import { bulkRevokeGrants } from "@/lib/ops/bulk-revoke"

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      all: { type: "boolean", default: false },
      yes: { type: "boolean", default: false },
    },
    allowPositionals: false,
  })

  if (!values.yes) {
    throw new Error("Refusing to revoke links without --yes.")
  }
  if (Boolean(values.all) === Boolean(values.email)) {
    throw new Error("Provide exactly one of --email <address> or --all.")
  }

  const result = await bulkRevokeGrants({ all: values.all, email: values.email })
  console.log(`Revoked ${result.revoked} live share link(s).`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
