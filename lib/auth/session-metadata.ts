function describeBrowser(userAgent: string): string | null {
  if (/Edg\//.test(userAgent)) return "Edge"
  if (/OPR\//.test(userAgent)) return "Opera"
  if (/Firefox\//.test(userAgent)) return "Firefox"
  if (/Chrome\//.test(userAgent) || /CriOS\//.test(userAgent)) return "Chrome"
  if (/Safari\//.test(userAgent)) return "Safari"
  return null
}

function describePlatform(userAgent: string): string | null {
  if (/iPhone|iPad|iPod/.test(userAgent)) return "iOS"
  if (/Android/.test(userAgent)) return "Android"
  if (/Macintosh|Mac OS X/.test(userAgent)) return "macOS"
  if (/Windows/.test(userAgent)) return "Windows"
  if (/Linux/.test(userAgent)) return "Linux"
  return null
}

export function describeUserAgent(userAgent: string | null | undefined): string {
  if (!userAgent) return "Unknown device"

  const browser = describeBrowser(userAgent)
  const platform = describePlatform(userAgent)

  if (browser && platform) return `${browser} on ${platform}`
  if (browser) return browser
  if (platform) return `${platform} device`
  return "Unknown device"
}

function decodeCity(city: string): string {
  try {
    return decodeURIComponent(city)
  } catch {
    return city
  }
}

export function describeLocation(
  city: string | null | undefined,
  country: string | null | undefined,
): string | null {
  const cityName = city?.trim()
  const countryCode = country?.trim().toUpperCase()

  if (cityName && countryCode) return `${decodeCity(cityName)}, ${countryCode}`
  if (cityName) return decodeCity(cityName)
  if (countryCode) return countryCode
  return null
}

export function sessionMetadataFromHeaders(getHeader: (name: string) => string | null): {
  deviceLabel: string
  locationLabel: string | null
} {
  return {
    deviceLabel: describeUserAgent(getHeader("user-agent")),
    locationLabel: describeLocation(
      getHeader("x-vercel-ip-city"),
      getHeader("x-vercel-ip-country"),
    ),
  }
}
