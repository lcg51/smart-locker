import { describe, expect, it } from "vitest"
import {
  describeLocation,
  describeUserAgent,
  sessionMetadataFromHeaders,
} from "@/lib/auth/session-metadata"

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
const MAC_CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
const WINDOWS_EDGE = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0"
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
const LINUX_FIREFOX = "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0"

describe("describeUserAgent", () => {
  it("labels common browser and platform pairs", () => {
    expect(describeUserAgent(IPHONE_SAFARI)).toBe("Safari on iOS")
    expect(describeUserAgent(MAC_CHROME)).toBe("Chrome on macOS")
    expect(describeUserAgent(WINDOWS_EDGE)).toBe("Edge on Windows")
    expect(describeUserAgent(ANDROID_CHROME)).toBe("Chrome on Android")
    expect(describeUserAgent(LINUX_FIREFOX)).toBe("Firefox on Linux")
  })

  it("falls back when the user agent is missing or unknown", () => {
    expect(describeUserAgent(null)).toBe("Unknown device")
    expect(describeUserAgent("")).toBe("Unknown device")
    expect(describeUserAgent("curl/8.0")).toBe("Unknown device")
  })
})

describe("describeLocation", () => {
  it("combines a decoded city with the country code", () => {
    expect(describeLocation("Madrid", "ES")).toBe("Madrid, ES")
    expect(describeLocation("San%20Francisco", "us")).toBe("San Francisco, US")
  })

  it("falls back to the country or null", () => {
    expect(describeLocation(null, "ES")).toBe("ES")
    expect(describeLocation("", "")).toBeNull()
    expect(describeLocation(null, null)).toBeNull()
  })
})

describe("sessionMetadataFromHeaders", () => {
  it("reads the user agent and Vercel geo headers", () => {
    const headers = new Map([
      ["user-agent", IPHONE_SAFARI],
      ["x-vercel-ip-city", "Madrid"],
      ["x-vercel-ip-country", "ES"],
    ])

    expect(sessionMetadataFromHeaders((name) => headers.get(name) ?? null)).toEqual({
      deviceLabel: "Safari on iOS",
      locationLabel: "Madrid, ES",
    })
  })
})
