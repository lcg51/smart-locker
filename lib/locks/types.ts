export type LockStatusValue = "locked" | "unlocked" | "unknown"

export type LockResult = { success: true } | { success: false; errorCode: string }

export type LockerState = {
  status: LockStatusValue
  batteryLevel: number | null
  online: boolean
}

export interface LockProvider {
  provision(input: { name: string }): Promise<{ vendorLockId: string }>
  unlock(vendorLockId: string): Promise<LockResult>
  lock(vendorLockId: string): Promise<LockResult>
  getState(vendorLockId: string): Promise<LockerState>
}
