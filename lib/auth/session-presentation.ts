import type { Locale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { fill } from "@/lib/i18n/format"

/**
 * Session metadata is derived and stored in English. Translate the shapes
 * `describeUserAgent` produces, and leave an unrecognized label as-is.
 */
export function formatDeviceLabel(label: string | null, locale: Locale): string {
  const settings = getDictionary(locale).settings

  if (!label || label === "Unknown device") return settings.unknownDevice

  const pair = /^(.+) on (.+)$/.exec(label)
  if (pair) {
    return fill(settings.deviceOnPlatform, { browser: pair[1], platform: pair[2] })
  }

  const platform = /^(.+) device$/.exec(label)
  if (platform) return fill(settings.devicePlatform, { platform: platform[1] })

  return label
}
