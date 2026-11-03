import { Bell, LockKeyhole, LogOut, ShieldCheck, SunMoon, UserRound } from "lucide-react"
import { AppearanceSettings } from "@/components/appearance-settings"
import { DeleteAccountDialog } from "@/components/delete-account-dialog"
import { GuestUnlockEmailToggle } from "@/components/guest-unlock-email-toggle"
import { PinSettings } from "@/components/pin-settings"
import { SignOutButton } from "@/components/sign-out-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireUser } from "@/lib/auth/session"
import { prisma } from "@/lib/db"

export default async function SettingsPage() {
  const user = await requireUser()
  const preferences = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { guestUnlockEmails: true },
  })

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <header className="mb-8">
        <p className="text-sm font-medium text-muted-foreground">Account</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-muted-foreground">Manage account notifications and security.</p>
      </header>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound aria-hidden="true" className="size-5" />
              Account
            </CardTitle>
            <CardDescription>Your sign-in email and session controls.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Email address</p>
              <p className="mt-1 break-all font-medium">{user.email}</p>
            </div>
            <SignOutButton className="min-h-11 w-full sm:w-auto" variant="outline">
              <LogOut aria-hidden="true" className="size-4" />
              Sign out
            </SignOutButton>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell aria-hidden="true" className="size-5" />
              Notifications
            </CardTitle>
            <CardDescription>Choose whether we email you about guest access to your lockers.</CardDescription>
          </CardHeader>
          <CardContent>
            <GuestUnlockEmailToggle userId={user.id} initialEnabled={preferences.guestUnlockEmails} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SunMoon aria-hidden="true" className="size-5" />
              Appearance
            </CardTitle>
            <CardDescription>Choose a theme for this browser, or match your device.</CardDescription>
          </CardHeader>
          <CardContent>
            <AppearanceSettings />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LockKeyhole aria-hidden="true" className="size-5" />
              Device lock
            </CardTitle>
            <CardDescription>Use an optional PIN to quickly reopen the app on this browser.</CardDescription>
          </CardHeader>
          <CardContent>
            <PinSettings />
          </CardContent>
        </Card>

        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <ShieldCheck aria-hidden="true" className="size-5" />
              Danger zone
            </CardTitle>
            <CardDescription>
              Permanently remove your Smart Locker account and the data associated with it.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-sm text-muted-foreground">
              Your lockers, share links, access history, sign-in sessions, and invite entry will be deleted.
            </p>
            <DeleteAccountDialog />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
