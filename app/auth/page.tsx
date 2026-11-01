import { LockKeyhole } from "lucide-react"
import { requestMagicLink } from "@/app/auth/actions"

export default function AuthPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <section aria-labelledby="sign-in-title" className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm sm:p-10">
        <div className="mb-8 text-center">
          <div className="mb-5 inline-flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <LockKeyhole aria-hidden="true" className="size-7" />
          </div>
          <h1 id="sign-in-title" className="text-3xl font-semibold tracking-tight">
            Smart Locker
          </h1>
          <p className="mt-2 text-muted-foreground">Sign in to manage your apartment lockers.</p>
        </div>

        <form action={requestMagicLink} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              Invited email address
            </label>
            <input
              autoComplete="email"
              className="flex min-h-12 w-full rounded-md border bg-background px-3 py-2 text-base outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              id="email"
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
            <p className="text-sm text-muted-foreground">We’ll email you a secure sign-in link.</p>
          </div>
          <button
            className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-primary px-4 font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            type="submit"
          >
            Send sign-in link
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Access is available to residents invited to this pilot.
        </p>
      </section>
    </main>
  )
}
