"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { storage } from "@/lib/storage"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Lock, Trash2, Info } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export default function SettingsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [currentPin, setCurrentPin] = useState("")
  const [newPin, setNewPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [isChangingPin, setIsChangingPin] = useState(false)

  const handleChangePIN = () => {
    const settings = storage.getSettings()

    if (currentPin !== settings.pin) {
      toast({
        title: "Error",
        description: "Current PIN is incorrect",
        variant: "destructive",
      })
      return
    }

    if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      toast({
        title: "Error",
        description: "New PIN must be 4 digits",
        variant: "destructive",
      })
      return
    }

    if (newPin !== confirmPin) {
      toast({
        title: "Error",
        description: "New PINs do not match",
        variant: "destructive",
      })
      return
    }

    settings.pin = newPin
    storage.saveSettings(settings)

    toast({
      title: "Success",
      description: "PIN changed successfully",
    })

    setCurrentPin("")
    setNewPin("")
    setConfirmPin("")
    setIsChangingPin(false)
  }

  const handleClearData = () => {
    if (typeof window !== "undefined") {
      localStorage.clear()
      sessionStorage.clear()
      router.push("/auth")
      toast({
        title: "Data Cleared",
        description: "All app data has been cleared",
      })
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage your app preferences and security</p>
        </div>

        <div className="space-y-6">
          {/* PIN Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                PIN Security
              </CardTitle>
              <CardDescription>Change your PIN to secure access to your lockers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isChangingPin ? (
                <Button onClick={() => setIsChangingPin(true)}>Change PIN</Button>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-pin">Current PIN</Label>
                    <Input
                      id="current-pin"
                      type="password"
                      maxLength={4}
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="Enter current PIN"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-pin">New PIN</Label>
                    <Input
                      id="new-pin"
                      type="password"
                      maxLength={4}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="Enter new 4-digit PIN"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-pin">Confirm New PIN</Label>
                    <Input
                      id="confirm-pin"
                      type="password"
                      maxLength={4}
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="Re-enter new PIN"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleChangePIN}>Save PIN</Button>
                    <Button variant="outline" onClick={() => setIsChangingPin(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* App Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                App Information
              </CardTitle>
              <CardDescription>Details about your Smart Locker app</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Version</span>
                <span className="font-medium">1.0.0</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Rooms Configured</span>
                <span className="font-medium">{storage.getRooms().length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Access Logs</span>
                <span className="font-medium">{storage.getAccessLogs().length}</span>
              </div>
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>Irreversible actions that affect your data</CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">Clear All Data</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete all your rooms, access logs, and
                      settings.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearData}>Clear All Data</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
