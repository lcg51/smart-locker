import Link from "next/link"

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <section aria-labelledby="auth-error-title" className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm sm:p-10">
        <h1 id="auth-error-title" className="text-2xl font-semibold tracking-tight">
          This pilot is invite-only
        </h1>
        <p className="mt-3 text-muted-foreground">
          This sign-in link could not be used. Check that you opened the latest link, or contact your building administrator if you were invited.
        </p>
        <Link
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md border px-5 font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          href="/auth"
        >
          Back to sign in
        </Link>
      </section>
    </main>
  )
}
