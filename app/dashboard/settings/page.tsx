import { Bell, Laptop, Languages, LockKeyhole, LogOut, ShieldCheck, SunMoon, UserRound } from "lucide-react"
import Link from "next/link"
import { AppearanceSettings } from "@/components/appearance-settings"
import { DeleteAccountDialog } from "@/components/delete-account-dialog"
import { GuestUnlockEmailToggle } from "@/components/guest-unlock-email-toggle"
import { LanguageSettings } from "@/components/language-settings"
import { PinSettings } from "@/components/pin-settings"
import { ProfileNameForm } from "@/components/profile-name-form"
import { SessionList } from "@/components/session-list"
import { SignOutButton } from "@/components/sign-out-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentSessionToken, listActiveSessions, requireUser } from "@/lib/auth/session"
import { formatDeviceLabel } from "@/lib/auth/session-presentation"
import { prisma } from "@/lib/db"
import type { Locale } from "@/lib/i18n/config"
import { getDictionary, getLocale } from "@/lib/i18n/server"

function formatSessionDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  }).format(date)
}

export default async function SettingsPage() {
  const user = await requireUser()
  const locale = await getLocale()
  const dictionary = getDictionary(locale)
  const preferences = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { guestUnlockEmails: true, name: true },
  })
  const currentToken = await getCurrentSessionToken()
  const sessions = await listActiveSessions(user.id, currentToken)
  const sessionRows = sessions.map((session) => ({
    id: session.id,
    createdAt: formatSessionDate(session.createdAt, locale),
    expires: formatSessionDate(session.expires, locale),
    isCurrent: session.isCurrent,
    deviceLabel: formatDeviceLabel(session.deviceLabel, locale),
    locationLabel: session.locationLabel,
  }))

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <header className="mb-8">
        <p className="text-sm font-medium text-muted-foreground">{dictionary.settings.eyebrow}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{dictionary.settings.title}</h1>
        <p className="mt-2 text-muted-foreground">{dictionary.settings.intro}</p>
      </header>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound aria-hidden="true" className="size-5" />
              {dictionary.settings.accountTitle}
            </CardTitle>
            <CardDescription>{dictionary.settings.accountDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{dictionary.settings.emailAddress}</p>
                <p className="mt-1 break-all font-medium">{user.email}</p>
                <Link className="mt-2 inline-block text-sm underline underline-offset-4" href="/privacy">
                  {dictionary.common.privacyNotice}
                </Link>
              </div>
              <SignOutButton className="min-h-11 w-full sm:w-auto" variant="outline">
                <LogOut aria-hidden="true" className="size-4" />
                {dictionary.common.signOut}
              </SignOutButton>
            </div>
            <div className="border-t pt-5">
              <ProfileNameForm currentName={preferences.name ?? ""} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Laptop aria-hidden="true" className="size-5" />
              {dictionary.settings.activeSessionsTitle}
            </CardTitle>
            <CardDescription>{dictionary.settings.activeSessionsDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <SessionList sessions={sessionRows} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell aria-hidden="true" className="size-5" />
              {dictionary.settings.notificationsTitle}
            </CardTitle>
            <CardDescription>{dictionary.settings.notificationsDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <GuestUnlockEmailToggle userId={user.id} initialEnabled={preferences.guestUnlockEmails} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SunMoon aria-hidden="true" className="size-5" />
              {dictionary.settings.appearanceTitle}
            </CardTitle>
            <CardDescription>{dictionary.settings.appearanceDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <AppearanceSettings />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Languages aria-hidden="true" className="size-5" />
              {dictionary.settings.languageTitle}
            </CardTitle>
            <CardDescription>{dictionary.settings.languageDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <LanguageSettings initialLocale={locale} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LockKeyhole aria-hidden="true" className="size-5" />
              {dictionary.settings.deviceLockTitle}
            </CardTitle>
            <CardDescription>{dictionary.settings.deviceLockDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <PinSettings />
          </CardContent>
        </Card>

        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive-text">
              <ShieldCheck aria-hidden="true" className="size-5" />
              {dictionary.settings.dangerTitle}
            </CardTitle>
            <CardDescription>{dictionary.settings.dangerDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-sm text-muted-foreground">{dictionary.settings.dangerBody}</p>
            <DeleteAccountDialog />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
