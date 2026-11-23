import { beforeEach, describe, expect, it, vi } from "vitest"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { resetDb } from "@/tests/helpers/db"
import { setLocale } from "@/app/actions/locale"

const { cookieSet, revalidatePath } = vi.hoisted(() => ({
  cookieSet: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: cookieSet })),
}))
vi.mock("next/cache", () => ({ revalidatePath }))
vi.mock("@/auth", () => ({ auth: vi.fn() }))

beforeEach(async () => {
  vi.clearAllMocks()
  vi.mocked(auth).mockReset()
  await resetDb()
})

describe("setLocale", () => {
  it("stores the choice in the cookie and on the signed-in resident", async () => {
    const user = await prisma.user.create({ data: { email: "resident@example.com" } })
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id, email: user.email } } as never)

    await setLocale("es")

    expect(cookieSet).toHaveBeenCalledWith(
      "NEXT_LOCALE",
      "es",
      expect.objectContaining({ path: "/", sameSite: "lax" }),
    )
    await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
      .resolves.toMatchObject({ locale: "es" })
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout")
  })

  it("keeps working for a guest without a session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never)

    await setLocale("es")

    expect(cookieSet).toHaveBeenCalledWith("NEXT_LOCALE", "es", expect.anything())
  })

  it("ignores an unsupported locale", async () => {
    await setLocale("fr" as never)

    expect(cookieSet).not.toHaveBeenCalled()
  })
})
