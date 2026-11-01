"use server"

import { requireUser } from "@/lib/auth/session"
import {
  lockLockerForUser,
  unlockLockerForUser,
} from "@/lib/lockers/service"

export async function unlockLocker(lockerId: string) {
  const user = await requireUser()
  return unlockLockerForUser({ userId: user.id, lockerId })
}

export async function lockLocker(lockerId: string) {
  const user = await requireUser()
  return lockLockerForUser({ userId: user.id, lockerId })
}
