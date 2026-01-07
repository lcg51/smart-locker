"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { storage } from "@/lib/storage"
import { bluetoothService } from "@/lib/bluetooth-service"
import type { Room, LockStatus } from "@/types/locker"
import { LockOpen, Lock, Wifi, Battery, Loader2, AlertCircle } from "lucide-react"

interface RoomCardProps {
  room: Room
  onUpdate: () => void
}

export function RoomCard({ room, onUpdate }: RoomCardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isLocked = room.locker.status === "locked"

  const handleToggleLock = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = isLocked
        ? await bluetoothService.unlock(room.locker.id)
        : await bluetoothService.lock(room.locker.id)

      if (result.success) {
        storage.updateRoomLocker(room.id, {
          status: result.status,
          lastAccessedAt: new Date(),
        })

        storage.addAccessLog({
          roomId: room.id,
          lockerId: room.locker.id,
          action: isLocked ? "unlock" : "lock",
          success: true,
        })

        // Trigger notification
        if (storage.getSettings().notificationsEnabled && "Notification" in window) {
          new Notification(`${room.name} ${isLocked ? "Unlocked" : "Locked"}`, {
            body: `Locker has been ${isLocked ? "unlocked" : "locked"} successfully.`,
            icon: "/favicon.ico",
          })
        }

        onUpdate()
      } else {
        setError("Failed to toggle lock. Please try again.")
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
      console.error("[v0] Lock toggle error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: LockStatus) => {
    switch (status) {
      case "locked":
        return "bg-green-500/10 text-green-700 dark:text-green-400"
      case "unlocked":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400"
      case "error":
        return "bg-destructive/10 text-destructive"
    }
  }

  const getBatteryColor = (level?: number) => {
    if (!level) return "text-muted-foreground"
    if (level > 50) return "text-green-600 dark:text-green-400"
    if (level > 20) return "text-amber-600 dark:text-amber-400"
    return "text-destructive"
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl mb-1">{room.name}</CardTitle>
            <CardDescription>{room.description}</CardDescription>
          </div>
          <Badge variant="outline" className={getStatusColor(room.locker.status)}>
            {room.locker.status === "locked" ? (
              <Lock className="h-3 w-3 mr-1" />
            ) : (
              <LockOpen className="h-3 w-3 mr-1" />
            )}
            {room.locker.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wifi className="h-4 w-4" />
            <span>Bluetooth</span>
          </div>
          <div className={`flex items-center gap-2 ${getBatteryColor(room.locker.batteryLevel)}`}>
            <Battery className="h-4 w-4" />
            <span className="font-medium">{room.locker.batteryLevel ?? 0}%</span>
          </div>
        </div>

        <Button onClick={handleToggleLock} disabled={isLoading} className="w-full" size="lg">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isLocked ? "Unlocking..." : "Locking..."}
            </>
          ) : (
            <>
              {isLocked ? <LockOpen className="h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
              {isLocked ? "Unlock" : "Lock"}
            </>
          )}
        </Button>

        {room.locker.lastAccessedAt && (
          <p className="text-xs text-muted-foreground text-center">
            Last accessed: {new Date(room.locker.lastAccessedAt).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
