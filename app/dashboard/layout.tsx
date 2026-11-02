import type { ReactNode } from "react"
import { Header } from "@/components/header"
import { AppLock } from "@/components/app-lock"
import { requireUser } from "@/lib/auth/session"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireUser()

  return (
    <AppLock>
      <div className="min-h-screen bg-background">
        <Header />
        {children}
      </div>
    </AppLock>
  )
}
