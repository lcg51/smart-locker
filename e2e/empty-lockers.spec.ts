import { expect, test } from "@playwright/test"
import { prisma } from "../lib/db"
import { signIn } from "./helpers"

const EMAIL = "empty@example.com"

test.beforeEach(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } })
  await prisma.user.create({ data: { email: EMAIL } })
})

test.afterEach(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } })
})

test("a resident with no lockers sees the next step and can recheck", async ({ browser }) => {
  const context = await browser.newContext({ locale: "en-GB" })
  const page = await context.newPage()
  await signIn(context, EMAIL)

  await page.goto("/dashboard")
  await expect(page.getByRole("heading", { name: "No lockers yet" })).toBeVisible()
  await expect(page.getByText("Your building administrator assigns lockers to your apartment.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Check again" })).toBeVisible()

  await context.close()
})

test("the empty state follows the Spanish locale", async ({ browser }) => {
  const context = await browser.newContext({ locale: "es-ES" })
  const page = await context.newPage()
  await signIn(context, EMAIL)

  await page.goto("/dashboard")
  await expect(page.getByRole("heading", { name: "Aún no hay taquillas" })).toBeVisible()
  await expect(page.getByText("La administración del edificio asigna las taquillas de tu vivienda.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Volver a comprobar" })).toBeVisible()

  await context.close()
})
