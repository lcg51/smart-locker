import { expect, test } from "@playwright/test"

test("the app exposes an installable manifest and icons", async ({ request, page }) => {
  const manifest = await request.get("/manifest.webmanifest")
  expect(manifest.status()).toBe(200)
  const body = await manifest.json()
  expect(body).toMatchObject({
    name: "Smart Locker",
    short_name: "Smart Locker",
    start_url: "/dashboard",
    display: "standalone",
  })
  expect(body.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: "192x192" }),
    expect.objectContaining({ sizes: "512x512" }),
    expect.objectContaining({ purpose: "maskable" }),
  ]))

  const icon = await request.get("/icons/icon-192.png")
  expect(icon.headers()["content-type"]).toContain("image/png")

  await page.goto("/offline")
  await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Try the dashboard" })).toBeVisible()
})
