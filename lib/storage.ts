import type { Room, AccessLog, AppSettings } from "@/types/locker"

const STORAGE_KEYS = {
  ROOMS: "smart-locker-rooms",
  ACCESS_LOGS: "smart-locker-logs",
  SETTINGS: "smart-locker-settings",
  PIN: "smart-locker-pin",
}

// Initialize default rooms
const DEFAULT_ROOMS: Room[] = [
  {
    id: "1",
    name: "Living Room",
    description: "Main living area storage",
    locker: {
      id: "locker-1",
      roomId: "1",
      status: "locked",
      bluetoothDeviceId: undefined,
      batteryLevel: 85,
    },
  },
  {
    id: "2",
    name: "Bedroom",
    description: "Master bedroom closet",
    locker: {
      id: "locker-2",
      roomId: "2",
      status: "locked",
      bluetoothDeviceId: undefined,
      batteryLevel: 92,
    },
  },
  {
    id: "3",
    name: "Kitchen",
    description: "Pantry storage",
    locker: {
      id: "locker-3",
      roomId: "3",
      status: "locked",
      bluetoothDeviceId: undefined,
      batteryLevel: 78,
    },
  },
  {
    id: "4",
    name: "Office",
    description: "Home office cabinet",
    locker: {
      id: "locker-4",
      roomId: "4",
      status: "locked",
      bluetoothDeviceId: undefined,
      batteryLevel: 65,
    },
  },
]

export const storage = {
  getRooms(): Room[] {
    if (typeof window === "undefined") return DEFAULT_ROOMS

    const stored = localStorage.getItem(STORAGE_KEYS.ROOMS)
    if (!stored) {
      this.saveRooms(DEFAULT_ROOMS)
      return DEFAULT_ROOMS
    }
    return JSON.parse(stored)
  },

  saveRooms(rooms: Room[]): void {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.ROOMS, JSON.stringify(rooms))
  },

  updateRoomLocker(roomId: string, updates: Partial<Room["locker"]>): void {
    const rooms = this.getRooms()
    const room = rooms.find((r) => r.id === roomId)
    if (room) {
      room.locker = { ...room.locker, ...updates }
      this.saveRooms(rooms)
    }
  },

  getAccessLogs(): AccessLog[] {
    if (typeof window === "undefined") return []

    const stored = localStorage.getItem(STORAGE_KEYS.ACCESS_LOGS)
    return stored ? JSON.parse(stored) : []
  },

  addAccessLog(log: Omit<AccessLog, "id" | "timestamp">): void {
    if (typeof window === "undefined") return

    const logs = this.getAccessLogs()
    const newLog: AccessLog = {
      ...log,
      id: Date.now().toString(),
      timestamp: new Date(),
    }
    logs.unshift(newLog)

    // Keep only last 100 logs
    if (logs.length > 100) {
      logs.splice(100)
    }

    localStorage.setItem(STORAGE_KEYS.ACCESS_LOGS, JSON.stringify(logs))
  },

  getSettings(): AppSettings {
    if (typeof window === "undefined") return { pin: "1234", notificationsEnabled: true }

    const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS)
    return stored ? JSON.parse(stored) : { pin: "1234", notificationsEnabled: true }
  },

  saveSettings(settings: AppSettings): void {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings))
  },

  isAuthenticated(): boolean {
    if (typeof window === "undefined") return false
    // Check cookie for authentication state (accessible by both client and middleware)
    return document.cookie.split("; ").some((cookie) => cookie === "authenticated=true")
  },

  setAuthenticated(value: boolean): void {
    if (typeof window === "undefined") return
    if (value) {
      // Set cookie with path=/ so it's accessible on all routes
      // Using SameSite=Lax for security while allowing normal navigation
      document.cookie = "authenticated=true; path=/; SameSite=Lax"
    } else {
      // Clear the cookie by setting it to expire in the past
      document.cookie = "authenticated=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
    }
  },
}
