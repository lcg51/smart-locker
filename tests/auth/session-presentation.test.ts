import { describe, expect, it } from "vitest"
import { formatDeviceLabel } from "@/lib/auth/session-presentation"

describe("formatDeviceLabel", () => {
  it("keeps the stored English labels", () => {
    expect(formatDeviceLabel("Safari on iOS", "en")).toBe("Safari on iOS")
    expect(formatDeviceLabel("Chrome on macOS", "en")).toBe("Chrome on macOS")
    expect(formatDeviceLabel("Android device", "en")).toBe("Android device")
    expect(formatDeviceLabel("Unknown device", "en")).toBe("Unknown device")
    expect(formatDeviceLabel(null, "en")).toBe("Unknown device")
  })

  it("translates the derived labels into Spanish", () => {
    expect(formatDeviceLabel("Safari on iOS", "es")).toBe("Safari en iOS")
    expect(formatDeviceLabel("Chrome on macOS", "es")).toBe("Chrome en macOS")
    expect(formatDeviceLabel("Android device", "es")).toBe("Dispositivo Android")
    expect(formatDeviceLabel("Unknown device", "es")).toBe("Dispositivo desconocido")
    expect(formatDeviceLabel(null, "es")).toBe("Dispositivo desconocido")
  })

  it("leaves a browser-only label and unknown text alone", () => {
    expect(formatDeviceLabel("Firefox", "es")).toBe("Firefox")
    expect(formatDeviceLabel("Living-room tablet", "es")).toBe("Living-room tablet")
  })
})
