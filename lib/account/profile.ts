import { prisma } from "@/lib/db"

export async function updateDisplayName(input: {
  userId: string
  name: string
}): Promise<boolean> {
  const name = input.name.trim()
  if (name.length < 1 || name.length > 40) return false

  const result = await prisma.user.updateMany({
    where: { id: input.userId },
    data: { name },
  })
  return result.count === 1
}
