import { Activity, LockKeyhole, LogOut, Settings } from "lucide-react"
import Link from "next/link"
import { logout } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"

export function Header() {
  return (
    <header className="border-b bg-card">
      <div className="container mx-auto flex min-h-16 items-center justify-between gap-4 px-4 py-3">
        <Link aria-label="Smart Locker dashboard" className="flex min-h-11 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" href="/dashboard">
          <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <LockKeyhole className="size-5" />
          </span>
          <span>
            <span className="block text-base font-semibold leading-tight">Smart Locker</span>
            <span className="block text-xs text-muted-foreground">Apartment access</span>
          </span>
        </Link>

        <nav aria-label="Account" className="flex items-center gap-1">
          <Button aria-label="Activity" className="size-11" variant="ghost" size="icon" asChild>
            <Link href="/dashboard/activity">
              <Activity aria-hidden="true" className="size-5" />
            </Link>
          </Button>
          <Button aria-label="Settings" className="size-11" variant="ghost" size="icon" asChild>
            <Link href="/dashboard/settings">
              <Settings aria-hidden="true" className="size-5" />
            </Link>
          </Button>
          <form action={logout}>
            <Button aria-label="Sign out" className="size-11" type="submit" variant="ghost" size="icon">
              <LogOut aria-hidden="true" className="size-5" />
            </Button>
          </form>
        </nav>
      </div>
    </header>
  )
}
