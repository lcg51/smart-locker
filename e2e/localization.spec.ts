import { createHash } from "node:crypto"
import { expect, test } from "@playwright/test"
import { prisma } from "../lib/db"
import { createShareForSeed, removeSeededShares, signIn } from "./helpers"

test.afterEach(async () => {
  await removeSeededShares()
  await prisma.verificationToken.deleteMany({ where: { identifier: "ana@example.com" } })
  await prisma.user.updateMany({
    where: { email: "ana@example.com" },
    data: { locale: "en" },
  })
})

test("a resident and a guest can use the app in Spanish", async ({ browser }) => {
  const owner = await browser.newContext({ locale: "en-GB" })
  const page = await owner.newPage()
  await signIn(owner)

  await page.goto("/dashboard/settings")
  await page.getByRole("radio", { name: "Español" }).click()
  await expect(page.getByRole("heading", { name: "Ajustes" })).toBeVisible()
  await expect(page.getByRole("radio", { name: "Español" })).toBeChecked()
  await expect(page.locator("html")).toHaveAttribute("lang", "es")

  await page.goto("/dashboard")
  await expect(page.getByRole("heading", { name: "Tus taquillas" })).toBeVisible()

  const { token } = await createShareForSeed({ durationMinutes: 60 })
  const guest = await browser.newContext({ locale: "es-ES" })
  const guestPage = await guest.newPage()
  await guestPage.goto(`/share/${token}`)

  await expect(guestPage.getByText("Acceso de invitado")).toBeVisible()
  await expect(guestPage.getByText("Tienes acceso a")).toBeVisible()
  await expect(guestPage.getByRole("heading", { name: "Kitchen" })).toBeVisible()
  await expect(guestPage.getByRole("button", { name: "Desbloquear taquilla" })).toBeVisible()
  await expect(guestPage.locator("html")).toHaveAttribute("lang", "es")

  const guestHtml = await guestPage.content()
  expect(guestHtml).not.toMatch(/TTLock|Upstash|Resend|Agencia Española/)

  await owner.close()
  await guest.close()
})

test("a Spanish browser gets a Spanish not-found page", async ({ browser }) => {
  const context = await browser.newContext({ locale: "es-ES" })
  const page = await context.newPage()
  const response = await page.goto("/this-page-does-not-exist")

  expect(response?.status()).toBe(404)
  await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Volver a Smart Locker" })).toBeVisible()
  await expect(page.locator("html")).toHaveAttribute("lang", "es")

  await context.close()
})

test("a Spanish-browser sign-in stores the locale used for email", async ({ browser }) => {
  const context = await browser.newContext({ locale: "es-ES" })
  const page = await context.newPage()
  const rawToken = `e2e-locale-signin-${Date.now()}`
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET is required for the E2E auth callback")
  const token = createHash("sha256").update(`${rawToken}${secret}`).digest("hex")

  await prisma.verificationToken.deleteMany({ where: { identifier: "ana@example.com" } })
  await prisma.verificationToken.create({
    data: {
      identifier: "ana@example.com",
      token,
      expires: new Date(Date.now() + 10 * 60_000),
    },
  })

  const callback = await context.request.get(
    `/api/auth/callback/resend?callbackUrl=%2Fdashboard&token=${rawToken}&email=${encodeURIComponent("ana@example.com")}`,
    { maxRedirects: 0, headers: { "accept-language": "es-ES,es;q=0.9" } },
  )
  expect(callback.status()).toBe(302)

  await page.goto("/dashboard")
  await expect(page.getByRole("heading", { name: "Tus taquillas" })).toBeVisible()
  await expect(prisma.user.findUniqueOrThrow({ where: { email: "ana@example.com" } }))
    .resolves.toMatchObject({ locale: "es" })

  await page.goto("/dashboard/settings")
  await expect(page.getByRole("radio", { name: "Español" })).toBeChecked()

  await context.close()
})
