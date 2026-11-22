import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

const ROOTS = ["app", "lib"]
const ALLOWED = /^export\s+(async function|type|interface)\b/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : []
  })
}

function isServerActionFile(source: string): boolean {
  return /^\s*["']use server["']/.test(source)
}

describe("use server modules", () => {
  it("export only async functions (and erased types)", () => {
    const offenders: string[] = []

    for (const root of ROOTS) {
      for (const file of sourceFiles(root)) {
        const source = readFileSync(file, "utf8")
        if (!isServerActionFile(source)) continue

        for (const line of source.split("\n")) {
          if (!line.startsWith("export ")) continue
          if (!ALLOWED.test(line)) offenders.push(`${relative(process.cwd(), file)}: ${line.trim()}`)
        }
      }
    }

    expect(offenders, offenders.join("\n")).toEqual([])
  })
})
