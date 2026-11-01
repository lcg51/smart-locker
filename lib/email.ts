export type GuestUnlockEmailInput = {
  to: string
  lockerName: string
  guestLabel: string | null
  unlockedAt: Date
}

export type GuestUnlockEmailSender = (input: GuestUnlockEmailInput) => Promise<boolean>

// Replaced by the transactional email implementation in Task 08.
export async function sendGuestUnlockEmail(_input: GuestUnlockEmailInput): Promise<boolean> {
  return false
}
