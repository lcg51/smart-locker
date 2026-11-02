"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireUser } from "@/lib/auth/session"
import {
  confirmLocker,
  lockLockerForUser,
  renameLocker,
  unlockLockerForUser,
} from "@/lib/lockers/service"
import { getLockersForUser } from "@/lib/lockers/queries"

export async function renameLockerAction(lockerId: string, formData: FormData): Promise<boolean> {
  const user = await requireUser()
  const name = formData.get("name")
  if (typeof name !== "string") return false

  const renamed = await renameLocker({ userId: user.id, lockerId, name })
  if (renamed) {
    revalidatePath("/onboarding")
    revalidatePath("/dashboard")
  }
  return renamed
}

export async function confirmLockerAction(lockerId: string): Promise<boolean> {
  const user = await requireUser()
  const confirmed = await confirmLocker({ userId: user.id, lockerId })
  if (!confirmed) return false

  revalidatePath("/onboarding")
  revalidatePath("/dashboard")
  const lockers = await getLockersForUser(user.id)
  if (lockers.length > 0 && lockers.every((locker) => locker.confirmedAt !== null)) {
    redirect("/dashboard")
  }
  return true
}

export async function unlockLocker(lockerId: string) {
  const user = await requireUser()
  return unlockLockerForUser({ userId: user.id, lockerId })
}

export async function lockLocker(lockerId: string) {
  const user = await requireUser()
  return lockLockerForUser({ userId: user.id, lockerId })
}
