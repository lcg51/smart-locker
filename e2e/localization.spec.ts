import { expect, test } from "@playwright/test"
import { prisma } from "../lib/db"
import { createShareForSeed, removeSeededShares, signIn } from "./helpers"

test.afterEach(async () => {
  await removeSeededShares()
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

  await owner.close()
  await guest.close()
})
