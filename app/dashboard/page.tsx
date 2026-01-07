"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { storage } from "@/lib/storage"
import { RoomCard } from "@/components/room-card"
import { Header } from "@/components/header"
import type { Room } from "@/types/locker"
import { Loader2 } from "lucide-react"

export default function DashboardPage() {
  const router = useRouter()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  useEffect(() => {
    console.log("[v0] Dashboard - checking authentication...")
    const isAuth = storage.isAuthenticated()
    console.log("[v0] Dashboard auth status:", isAuth)

    if (!isAuth) {
      console.log("[v0] Not authenticated on dashboard, redirecting to auth...")
      router.replace("/auth")
      return
    }

    console.log("[v0] Authenticated, loading rooms...")
    setIsCheckingAuth(false)
    loadRooms()
  }, [router])

  const loadRooms = () => {
    const loadedRooms = storage.getRooms()
    console.log("[v0] Loaded rooms:", loadedRooms.length)
    setRooms(loadedRooms)
    setLoading(false)
  }

  const handleLogout = () => {
    console.log("[v0] Logging out...")
    storage.setAuthenticated(false)
    router.replace("/auth")
  }

  if (isCheckingAuth || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onLogout={handleLogout} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-balance">Your Rooms</h1>
          <p className="text-muted-foreground">Manage and control smart lockers in your apartment</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} onUpdate={loadRooms} />
          ))}
        </div>
      </main>
    </div>
  )
}
