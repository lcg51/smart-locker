import { mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import sharp from "sharp"

const source = resolve("public/icons/source.svg")
const outputDir = resolve("public/icons")

// The source keeps the lock mark inside the maskable safe zone, so the same
// artwork can back both the standard and maskable icons.
const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "icon-maskable-512.png", size: 512 },
]

async function main(): Promise<void> {
  await mkdir(outputDir, { recursive: true })

  for (const target of targets) {
    await sharp(source)
      .resize(target.size, target.size, { fit: "cover" })
      .png()
      .toFile(resolve(outputDir, target.file))
    console.log(`wrote public/icons/${target.file}`)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
