import { expect, test } from "@playwright/test"

test("owner shares a locker, guest unlocks, owner revokes", async ({ browser }) => {
  const owner = await browser.newContext()
  const guest = await browser.newContext()

  try {
    const page = await owner.newPage()
    const sessionResponse = await owner.request.post("/api/test/session", {
      data: { email: "ana@example.com" },
    })
    expect(sessionResponse.status()).toBe(200)

    await page.goto("/onboarding")
    await page.getByRole("button", { name: "Confirm this locker" }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    await expect(page.getByRole("heading", { name: "Your lockers" })).toBeVisible()
    await page.getByRole("button", { name: "Unlock", exact: true }).click()
    await expect(page.getByText("Unlocked", { exact: true })).toBeVisible()

    await page.getByRole("link", { name: "Locker details" }).click()
    await page.getByRole("button", { name: "Share access" }).click()
    await page.getByLabel("Guest label").fill("Ana")
    await page.getByRole("button", { name: "Create share link" }).click()
    const shareUrl = await page.getByTestId("share-url").inputValue()
    expect(shareUrl).toContain("/share/")
    await page.getByRole("button", { name: "Close share dialog" }).click()

    const guestPage = await guest.newPage()
    await guestPage.goto(shareUrl)
    await expect(guestPage.getByText("ana@example.com")).toHaveCount(0)
    await expect(guestPage.getByText("gw-e2e")).toHaveCount(0)
    await guestPage.getByRole("button", { name: "Unlock locker" }).click()
    await expect(guestPage.getByText("Locker unlocked")).toBeVisible()
    await expect(guestPage.getByText("Locker relocked.")).toBeVisible({ timeout: 10_000 })

    const lockerId = new URL(page.url()).pathname.split("/").at(-1)
    expect(lockerId).toBeTruthy()
    await expect.poll(async () => {
      const response = await owner.request.get(`/api/lockers/${lockerId}/state`)
      return (await response.json()).status
    }).toBe("locked")

    await page.getByRole("button", { name: "Revoke", exact: true }).click()
    await page.getByRole("button", { name: "Revoke link" }).click()
    await expect(page.getByText("No active share links.")).toBeVisible()

    await guestPage.reload()
    await expect(guestPage.getByText("no longer available")).toBeVisible()
  } finally {
    await owner.close()
    await guest.close()
  }
})
