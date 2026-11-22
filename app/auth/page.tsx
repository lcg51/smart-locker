import Link from "next/link"
import { LockKeyhole } from "lucide-react"
import { AuthForm } from "@/components/auth-form"
import { authNotice } from "@/lib/auth/sign-in-notice"

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

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

        <AuthForm notice={authNotice(error)} />

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Access is available to residents invited to this pilot.{" "}
          <Link className="underline underline-offset-4" href="/privacy">Privacy notice</Link>
        </p>
      </section>
    </main>
  )
}
