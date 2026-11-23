import Link from "next/link"
import { LockKeyhole } from "lucide-react"
import { AuthForm } from "@/components/auth-form"
import { authNoticeKey } from "@/lib/auth/sign-in-notice"
import { getDictionary, getLocale } from "@/lib/i18n/server"

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const [{ error }, locale] = await Promise.all([searchParams, getLocale()])
  const dictionary = getDictionary(locale)
  const noticeKey = authNoticeKey(error)

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <section aria-labelledby="sign-in-title" className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm sm:p-10">
        <div className="mb-8 text-center">
          <div className="mb-5 inline-flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <LockKeyhole aria-hidden="true" className="size-7" />
          </div>
          <h1 id="sign-in-title" className="text-3xl font-semibold tracking-tight">
            {dictionary.auth.title}
          </h1>
          <p className="mt-2 text-muted-foreground">{dictionary.auth.subtitle}</p>
        </div>

        <AuthForm notice={noticeKey ? dictionary.auth.notice[noticeKey] : null} />

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {dictionary.auth.inviteOnly}{" "}
          <Link className="underline underline-offset-4" href="/privacy">
            {dictionary.common.privacyNotice}
          </Link>
        </p>
      </section>
    </main>
  )
}
