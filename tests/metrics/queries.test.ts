import { beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { getPilotMetrics } from "@/lib/metrics/queries"
import { provisionApartment } from "@/lib/ops/provision"
import { createShareGrant } from "@/lib/shares/service"
import { resetDb } from "@/tests/helpers/db"

const FROM = new Date("2026-10-01T00:00:00.000Z")
const TO = new Date("2026-11-01T00:00:00.000Z")
const NOW = new Date("2026-11-03T00:00:00.000Z")
const IN_WINDOW = new Date("2026-10-15T12:00:00.000Z")

beforeEach(resetDb)

async function seedResident(email: string, gatewayId: string, vendorLockId: string) {
  const { userId } = await provisionApartment({
    email,
    gatewayId,
    lockers: [{ name: "Kitchen", vendor: "mock", vendorLockId }],
  })
  const locker = await prisma.locker.findFirstOrThrow({ where: { userId } })
  return { userId, lockerId: locker.id }
}

async function addEvent(input: {
  lockerId: string
  actorType: "OWNER" | "GUEST" | "SYSTEM"
  action?: "UNLOCK" | "LOCK"
  success: boolean
  grantId?: string
  createdAt?: Date
}) {
  return prisma.lockEvent.create({
    data: {
      lockerId: input.lockerId,
      actorType: input.actorType,
      action: input.action ?? "UNLOCK",
      success: input.success,
      grantId: input.grantId,
      createdAt: input.createdAt ?? IN_WINDOW,
    },
  })
}

describe("getPilotMetrics", () => {
  it("reports the pilot success signals for a date window", async () => {
    const ana = await seedResident("ana@example.com", "gw-ana", "ana-lock")
    const beto = await seedResident("beto@example.com", "gw-beto", "beto-lock")

    const redeemed = await createShareGrant({
      userId: ana.userId,
      lockerId: ana.lockerId,
      now: IN_WINDOW,
      guestLabel: "Cleaner",
    })
    await prisma.shareGrant.update({
      where: { id: redeemed.grant.id },
      data: { expiresAt: new Date("2026-12-01T00:00:00.000Z") },
    })
    const revoked = await createShareGrant({
      userId: ana.userId,
      lockerId: ana.lockerId,
      now: IN_WINDOW,
    })
    await prisma.shareGrant.update({
      where: { id: revoked.grant.id },
      data: { revokedAt: new Date("2026-10-20T12:00:00.000Z") },
    })

    await addEvent({ lockerId: ana.lockerId, actorType: "OWNER", success: true })
    await addEvent({ lockerId: ana.lockerId, actorType: "OWNER", success: true })
    await addEvent({ lockerId: beto.lockerId, actorType: "OWNER", success: true })
    await addEvent({
      lockerId: ana.lockerId,
      actorType: "GUEST",
      success: true,
      grantId: redeemed.grant.id,
    })
    await addEvent({
      lockerId: ana.lockerId,
      actorType: "GUEST",
      success: false,
      grantId: redeemed.grant.id,
    })
    await addEvent({ lockerId: ana.lockerId, actorType: "OWNER", action: "LOCK", success: true })
    await addEvent({ lockerId: ana.lockerId, actorType: "SYSTEM", action: "LOCK", success: true })

    const metrics = await getPilotMetrics({ from: FROM, to: TO, now: NOW })

    expect(metrics).toMatchObject({
      activeResidents: 2,
      ownerUnlocks: 3,
      guestUnlocks: 1,
      failedUnlocks: 1,
      sharesCreated: 2,
      sharesRedeemed: 1,
      revokedShares: 1,
      expiredShares: 0,
    })
    expect(metrics.unlockSuccessRate).toBeCloseTo(0.8)
    expect(metrics.shareConversionRate).toBeCloseTo(0.5)
  })

  it("returns zero rates when there is nothing in the window", async () => {
    await expect(getPilotMetrics({ from: FROM, to: TO, now: NOW })).resolves.toEqual({
      activeResidents: 0,
      ownerUnlocks: 0,
      guestUnlocks: 0,
      failedUnlocks: 0,
      unlockSuccessRate: 0,
      sharesCreated: 0,
      sharesRedeemed: 0,
      shareConversionRate: 0,
      revokedShares: 0,
      expiredShares: 0,
    })
  })

  it("excludes events and grants outside the window and counts a grant once", async () => {
    const ana = await seedResident("ana@example.com", "gw-ana", "ana-lock")
    const grant = await createShareGrant({
      userId: ana.userId,
      lockerId: ana.lockerId,
      now: IN_WINDOW,
    })
    const beforeWindowGrant = await createShareGrant({
      userId: ana.userId,
      lockerId: ana.lockerId,
      now: new Date("2026-09-01T00:00:00.000Z"),
    })
    await addEvent({
      lockerId: ana.lockerId,
      actorType: "GUEST",
      success: true,
      grantId: grant.grant.id,
    })
    await addEvent({
      lockerId: ana.lockerId,
      actorType: "GUEST",
      success: true,
      grantId: grant.grant.id,
    })
    await addEvent({
      lockerId: ana.lockerId,
      actorType: "OWNER",
      success: true,
      createdAt: new Date("2026-09-15T00:00:00.000Z"),
    })
    expect(beforeWindowGrant.token).toBeTruthy()

    const metrics = await getPilotMetrics({ from: FROM, to: TO, now: NOW })

    expect(metrics).toMatchObject({
      activeResidents: 1,
      guestUnlocks: 2,
      sharesCreated: 1,
      sharesRedeemed: 1,
      shareConversionRate: 1,
    })
  })

  it("counts an expired grant that was created in the window", async () => {
    const ana = await seedResident("ana@example.com", "gw-ana", "ana-lock")
    const grant = await createShareGrant({
      userId: ana.userId,
      lockerId: ana.lockerId,
      now: IN_WINDOW,
    })
    await prisma.shareGrant.update({
      where: { id: grant.grant.id },
      data: { expiresAt: new Date("2026-10-20T00:00:00.000Z") },
    })

    await expect(getPilotMetrics({ from: FROM, to: TO, now: NOW }))
      .resolves.toMatchObject({ sharesCreated: 1, revokedShares: 0, expiredShares: 1 })
  })
})
