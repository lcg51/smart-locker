import { MailCheck } from "lucide-react"

export default function CheckEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <section aria-labelledby="check-email-title" className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm sm:p-10">
        <MailCheck aria-hidden="true" className="mx-auto mb-5 size-12 text-primary" />
        <h1 id="check-email-title" className="text-2xl font-semibold tracking-tight">
          Check your email
        </h1>
        <p className="mt-3 text-muted-foreground">
          If your address is invited, we’ve sent you a sign-in link. Open it on this device to continue.
        </p>
      </section>
    </main>
  )
}
