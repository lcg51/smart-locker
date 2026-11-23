import type { Metadata } from "next"
import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { getEnv } from "@/lib/env"
import { getDictionary, getLocale } from "@/lib/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).privacy.metaTitle }
}

export default async function PrivacyPage() {
  const contact = getEnv().PRIVACY_CONTACT_EMAIL
  const dictionary = getDictionary(await getLocale())
  const privacy = dictionary.privacy

  return (
    <main className="container mx-auto max-w-3xl px-4 py-10 sm:py-12">
      <header className="mb-8">
        <p className="text-sm font-medium text-muted-foreground">{privacy.eyebrow}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{privacy.title}</h1>
        <p className="mt-3 text-muted-foreground">{privacy.intro}</p>
      </header>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold leading-none">{privacy.controllerTitle}</h2>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              {privacy.controllerBody}
              <a className="font-medium text-foreground underline underline-offset-4" href={`mailto:${contact}`}>
                {contact}
              </a>.
            </p>
            <p>{privacy.controllerRegion}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold leading-none">{privacy.collectTitle}</h2>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ul className="list-disc space-y-1 pl-5">
              {privacy.collectItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold leading-none">{privacy.whyTitle}</h2>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ul className="list-disc space-y-1 pl-5">
              {privacy.whyItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <p>{privacy.whyLegal}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold leading-none">{privacy.processorsTitle}</h2>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>{privacy.processorsIntro}</p>
            <ul className="list-disc space-y-1 pl-5">
              {privacy.processorItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <p>{privacy.processorsDocs}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold leading-none">{privacy.retentionTitle}</h2>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ul className="list-disc space-y-1 pl-5">
              {privacy.retentionItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <p>{privacy.retentionSchedule}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold leading-none">{privacy.rightsTitle}</h2>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>{privacy.rightsBody}</p>
            <p>
              {privacy.rightsAepdBefore}
              <a className="font-medium text-foreground underline underline-offset-4" href="https://www.aepd.es">aepd.es</a>.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold leading-none">{privacy.cookiesTitle}</h2>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>{privacy.cookiesBody}</p>
            <p>{privacy.analyticsBody}</p>
          </CardContent>
        </Card>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        <Link className="underline underline-offset-4" href="/auth">{dictionary.common.backToSignIn}</Link>
      </p>
    </main>
  )
}
