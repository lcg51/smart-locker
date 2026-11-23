"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { isLocale, localeCookie, type Locale } from "@/lib/i18n/config"

export async function setLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return

  const store = await cookies()
  store.set(localeCookie, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  })

  const session = await auth()
  if (session?.user?.id) {
    await prisma.user.update({ where: { id: session.user.id }, data: { locale } })
  }

  revalidatePath("/", "layout")
}
