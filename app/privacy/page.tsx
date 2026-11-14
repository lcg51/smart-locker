import type { Metadata } from "next"
import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { getEnv } from "@/lib/env"

export const metadata: Metadata = { title: "Privacy notice" }

export default function PrivacyPage() {
  const contact = getEnv().PRIVACY_CONTACT_EMAIL

  return (
    <main className="container mx-auto max-w-3xl px-4 py-10 sm:py-12">
      <header className="mb-8">
        <p className="text-sm font-medium text-muted-foreground">Smart Locker pilot</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Privacy notice</h1>
        <p className="mt-3 text-muted-foreground">
          This notice explains what the Smart Locker pilot collects, why, how long it keeps it,
          and how to exercise your data rights in Spain.
        </p>
      </header>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold leading-none">Who controls your data</h2>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              The Smart Locker pilot operator is the data controller for resident accounts,
              lockers, and guest access. For privacy questions or requests, contact{" "}
              <a className="font-medium text-foreground underline underline-offset-4" href={`mailto:${contact}`}>
                {contact}
              </a>.
            </p>
            <p>
              The pilot runs in Spain and uses EU hosting where available. The operator confirms
              the controller entity and legal bases with counsel before inviting residents.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold leading-none">What we collect</h2>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ul className="list-disc space-y-1 pl-5">
              <li>Your invited email address, display name, and sign-in sessions.</li>
              <li>Locker names, confirmation status, lock state, battery level, and last sync time.</li>
              <li>Lock and unlock events, including which resident or guest link caused them.</li>
              <li>Share-link metadata: guest label, expiry, use count, and revocation time. The raw link is never stored; only a SHA-256 hash is kept.</li>
              <li>Hashed IP addresses for redemption abuse controls, and rate-limit keys for sign-in, sharing, and lock commands.</li>
              <li>Email delivery metadata from the email provider when a notification is sent.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold leading-none">Why we use it</h2>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ul className="list-disc space-y-1 pl-5">
              <li>To provide the service you signed up for: confirming lockers, unlocking them, and sharing temporary guest access.</li>
              <li>To keep the service secure: rate limiting, abuse prevention, and lock event history.</li>
              <li>To meet legal and accounting obligations that apply to the pilot operator.</li>
              <li>To send optional guest-unlock notifications when you enable them in Settings.</li>
            </ul>
            <p>
              The operator relies on performance of the service, legitimate interests in security and
              abuse prevention, and legal obligations. Counsel confirms the final legal bases before launch.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold leading-none">Who processes it</h2>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>The pilot uses these processors under their data-processing terms:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Vercel for hosting and product analytics.</li>
              <li>A managed PostgreSQL provider for the application database, in an EU region where available.</li>
              <li>Resend for sign-in and guest-unlock email delivery.</li>
              <li>Upstash for distributed rate limiting when configured.</li>
              <li>TTLock as the lock vendor in Phase 2; hardware is not connected during the mock-provider pilot.</li>
            </ul>
            <p>
              The operator keeps the processor, region, and transfer checklist in
              <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">docs/privacy/processor-region-checklist.md</code>
              and completes every open item before inviting residents.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold leading-none">How long we keep it</h2>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ul className="list-disc space-y-1 pl-5">
              <li>Inactive share links are deleted 30 days after they expire or are revoked.</li>
              <li>Expired sessions and verification tokens are deleted 30 days after expiry.</li>
              <li>Lock event history is deleted after 12 months.</li>
              <li>Deleting your account removes your account, lockers, share links, access history, sessions, and invite entry immediately.</li>
              <li>Provider backups expire on the provider&apos;s documented schedule.</li>
            </ul>
            <p>
              The daily retention job runs at 03:00 UTC. Account deletion is always available in
              Settings and is not delayed by the retention schedule.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold leading-none">Your rights</h2>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              You can ask for access, correction, deletion, restriction, objection, or portability
              of your data, and you can withdraw consent where consent is the basis. Use the contact
              address above or delete your account in Settings.
            </p>
            <p>
              You can also complain to the Spanish data-protection authority, the Agencia Española
              de Protección de Datos (AEPD), at <a className="font-medium text-foreground underline underline-offset-4" href="https://www.aepd.es">aepd.es</a>.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold leading-none">Cookies, local storage, and analytics</h2>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              The app uses an essential session cookie for sign-in, browser local storage for your
              theme choice, and a salted hash in local storage if you enable the optional device PIN.
              It does not use advertising cookies or sell personal data.
            </p>
            <p>
              Product analytics runs on resident pages. It is suppressed on <code className="rounded bg-muted px-1 py-0.5 text-xs">/share/*</code>,
              and share pages send <code className="rounded bg-muted px-1 py-0.5 text-xs">Referrer-Policy: no-referrer</code>,
              <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">noindex</code>, and
              <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">no-store</code> so a guest link is not indexed, cached, or shared with analytics.
            </p>
          </CardContent>
        </Card>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        <Link className="underline underline-offset-4" href="/auth">Back to sign in</Link>
      </p>
    </main>
  )
}
