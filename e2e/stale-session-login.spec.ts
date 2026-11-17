import { createHash, randomBytes } from "node:crypto"
import { expect, test } from "@playwright/test"
import { prisma } from "../lib/db"

test("a stale session cookie does not block email sign-in", async ({ context, page }) => {
  const sessionResponse = await context.request.post("/api/test/session", {
    data: { email: "ana@example.com" },
  })
  expect(sessionResponse.status()).toBe(200)

  const user = await prisma.user.findUniqueOrThrow({
    where: { email: "ana@example.com" },
    select: { id: true, email: true },
  })

  // Simulate revoking the session while the browser still holds its cookie.
  await prisma.session.deleteMany({ where: { userId: user.id } })

  const rawToken = randomBytes(32).toString("hex")
  const storedToken = createHash("sha256")
    .update(`${rawToken}${process.env.AUTH_SECRET}`)
    .digest("hex")
  await prisma.verificationToken.create({
    data: {
      identifier: user.email!,
      token: storedToken,
      expires: new Date(Date.now() + 60_000),
    },
  })

  try {
    const params = new URLSearchParams({
      callbackUrl: "/dashboard",
      token: rawToken,
      email: user.email!,
    })

    await page.goto(`/api/auth/callback/resend?${params}`)

    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByRole("heading", { name: "Your lockers" })).toBeVisible()
  } finally {
    await prisma.verificationToken.deleteMany({ where: { token: storedToken } })
    await prisma.session.deleteMany({ where: { userId: user.id } })
  }
})
