export function isGuestUnlockDisabled(input: {
  isPending: boolean
  isCoolingDown: boolean
  canUnlockAgain: boolean
}): boolean {
  return input.isPending || input.isCoolingDown || !input.canUnlockAgain
}
