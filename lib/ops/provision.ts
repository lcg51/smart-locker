import { prisma } from "@/lib/db"

export type ProvisionInput = {
  email: string
  gatewayId: string
  lockers: Array<{ name: string; vendor: string; vendorLockId: string }>
}

export async function provisionApartment(
  input: ProvisionInput,
): Promise<{ userId: string }> {
  const email = input.email.trim().toLowerCase()

  return prisma.$transaction(async (tx) => {
    await tx.allowedEmail.upsert({
      where: { email },
      create: { email },
      update: {},
    })

    const user = await tx.user.upsert({
      where: { email },
      create: { email, vendorGatewayId: input.gatewayId },
      update: { vendorGatewayId: input.gatewayId },
    })

    for (const locker of input.lockers) {
      const provisionedLocker = await tx.locker.upsert({
        where: {
          vendor_vendorLockId: {
            vendor: locker.vendor,
            vendorLockId: locker.vendorLockId,
          },
        },
        create: { ...locker, userId: user.id },
        update: { name: locker.name },
      })

      if (provisionedLocker.userId !== user.id) {
        throw new Error("Locker is already provisioned to another resident")
      }
    }

    return { userId: user.id }
  })
}
