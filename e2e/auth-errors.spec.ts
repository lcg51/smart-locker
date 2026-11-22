import { createHash } from "node:crypto"
import { expect, test } from "@playwright/test"
import { prisma } from "../lib/db"
import { SIGN_IN_LINK_ERROR } from "../lib/auth/sign-in-notice"

const UNINVITED = "uninvited@example.com"

test.afterEach(async () => {
  await prisma.$executeRaw`delete from "VerificationToken" where identifier = ${UNINVITED}`
})

test("an uninvited sign-in link redirects to the auth page with a neutral toast", async ({ page, context }) => {
  // Auth.js stores sha256(token + secret) and consumes it on the callback.
  const rawToken = `e2e-rejection-${Date.now()}`
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET is required for the E2E auth callback")
  const token = createHash("sha256").update(`${rawToken}${secret}`).digest("hex")

  await prisma.allowedEmail.deleteMany({ where: { email: UNINVITED } })
  await prisma.verificationToken.create({
    data: { identifier: UNINVITED, token, expires: new Date(Date.now() + 10 * 60_000) },
  })

  const callback = await context.request.get(
    `/api/auth/callback/resend?callbackUrl=%2Fdashboard&token=${rawToken}&email=${encodeURIComponent(UNINVITED)}`,
    { maxRedirects: 0 },
  )

  expect(callback.status()).toBe(302)
  const location = callback.headers()["location"]
  expect(location).toContain("/auth?error=not_invited")

  await page.goto(location)
  await expect(page.getByRole("heading", { name: "Smart Locker" })).toBeVisible()
  await expect(page.getByText(SIGN_IN_LINK_ERROR, { exact: true })).toBeVisible()
  await expect(page.getByLabel("Invited email address")).toBeVisible()
})
