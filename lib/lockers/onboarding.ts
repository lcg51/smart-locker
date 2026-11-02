export function canConfirmLockerName(currentName: string, savedName: string): boolean {
  const current = currentName.trim()
  return current.length >= 1 && current.length <= 40 && current === savedName.trim()
}

export function canEditLockerName(isPending: boolean): boolean {
  return !isPending
}
