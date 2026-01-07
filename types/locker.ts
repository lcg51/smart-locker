export type LockStatus = "locked" | "unlocked" | "error"

export interface Room {
  id: string
  name: string
  description?: string
  locker: Locker
}

export interface Locker {
  id: string
  roomId: string
  status: LockStatus
  bluetoothDeviceId?: string
  lastAccessedAt?: Date
  batteryLevel?: number
}

export interface AccessLog {
  id: string
  roomId: string
  lockerId: string
  action: "unlock" | "lock"
  timestamp: Date
  success: boolean
}

export interface AppSettings {
  pin: string
  notificationsEnabled: boolean
}
