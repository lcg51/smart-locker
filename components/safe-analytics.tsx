"use client"

import { usePathname } from "next/navigation"
import { Analytics } from "@vercel/analytics/next"
import { shouldTrackPageview } from "@/lib/analytics"

export function SafeAnalytics() {
  const pathname = usePathname()
  if (!shouldTrackPageview(pathname)) return null

  return <Analytics />
}
