"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { storage } from "@/lib/storage"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import type { AccessLog } from "@/types/locker"
import { Lock, LockOpen, Clock, CheckCircle, XCircle, Bell, BellOff } from "lucide-react"

export default function NotificationsPage() {
  const router = useRouter()
  const [logs, setLogs] = useState<AccessLog[]>([])
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default")

  useEffect(() => {
    if (!storage.isAuthenticated()) {
      router.push("/auth")
      return
    }

    loadLogs()
    checkNotificationPermission()
  }, [router])

  const loadLogs = () => {
    const accessLogs = storage.getAccessLogs()
    setLogs(accessLogs)
    const settings = storage.getSettings()
    setNotificationsEnabled(settings.notificationsEnabled)
  }

  const checkNotificationPermission = () => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission)
    }
  }

  const handleLogout = () => {
    storage.setAuthenticated(false)
    router.push("/auth")
  }

  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission()
      setNotificationPermission(permission)
      if (permission === "granted") {
        handleToggleNotifications(true)
      }
    }
  }

  const handleToggleNotifications = (enabled: boolean) => {
    const settings = storage.getSettings()
    settings.notificationsEnabled = enabled
    storage.saveSettings(settings)
    setNotificationsEnabled(enabled)
  }

  const getRoomName = (roomId: string) => {
    const rooms = storage.getRooms()
    const room = rooms.find((r) => r.id === roomId)
    return room?.name || "Unknown Room"
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onLogout={handleLogout} />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Notifications</h1>
          <p className="text-muted-foreground">Manage notification settings and view access history</p>
        </div>

        <div className="space-y-6">
          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {notificationsEnabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
                Notification Settings
              </CardTitle>
              <CardDescription>Control when you receive notifications about locker access</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {notificationPermission !== "granted" && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-3">
                    Enable browser notifications to receive real-time alerts when lockers are accessed.
                  </p>
                  <Button onClick={requestNotificationPermission} size="sm">
                    <Bell className="h-4 w-4 mr-2" />
                    Enable Notifications
                  </Button>
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label htmlFor="notifications-toggle" className="flex flex-col gap-1">
                  <span className="font-medium">Push Notifications</span>
                  <span className="text-sm text-muted-foreground font-normal">
                    Get notified when lockers are locked or unlocked
                  </span>
                </Label>
                <Switch
                  id="notifications-toggle"
                  checked={notificationsEnabled}
                  onCheckedChange={handleToggleNotifications}
                  disabled={notificationPermission !== "granted"}
                />
              </div>
            </CardContent>
          </Card>

          {/* Access History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Access History
              </CardTitle>
              <CardDescription>Recent locker access activities</CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No access history yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${log.action === "unlock" ? "bg-amber-500/10" : "bg-green-500/10"}`}
                        >
                          {log.action === "unlock" ? (
                            <LockOpen className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <Lock className="h-4 w-4 text-green-600 dark:text-green-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{getRoomName(log.roomId)}</p>
                          <p className="text-sm text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {log.action}
                        </Badge>
                        {log.success ? (
                          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <XCircle className="h-5 w-5 text-destructive" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
