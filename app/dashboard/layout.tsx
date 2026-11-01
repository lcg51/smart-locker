import type { ReactNode } from "react"
import { Header } from "@/components/header"
import { requireUser } from "@/lib/auth/session"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireUser()

  return (
    <div className="min-h-screen bg-background">
      <Header />
      {children}
    </div>
  )
}
