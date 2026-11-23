import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { I18nProvider } from "@/components/i18n-provider"
import { SafeAnalytics } from "@/components/safe-analytics"
import { ServiceWorker } from "@/components/service-worker"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { getClientDictionary, getDictionary, getLocale } from "@/lib/i18n/server"

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = getDictionary(await getLocale())

  return {
    title: dictionary.meta.title,
    description: dictionary.meta.description,
    icons: {
      icon: [
        {
          url: "/icon-light-32x32.png",
          media: "(prefers-color-scheme: light)",
        },
        {
          url: "/icon-dark-32x32.png",
          media: "(prefers-color-scheme: dark)",
        },
        {
          url: "/icon.svg",
          type: "image/svg+xml",
        },
      ],
      apple: "/apple-icon.png",
    },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  const clientDictionary = getClientDictionary(locale)

  return (
    <html
      className={`${geistSans.variable} ${geistMono.variable}`}
      lang={locale}
      suppressHydrationWarning
    >
      <body className={`font-sans antialiased`}>
        <ThemeProvider>
          <I18nProvider dictionary={clientDictionary} locale={locale}>
            {children}
            <Toaster />
            <SafeAnalytics />
            <ServiceWorker />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
