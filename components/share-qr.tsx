"use client"

import { QRCodeSVG } from "qrcode.react"
import { useI18n } from "@/components/i18n-provider"

export function ShareQr({ url }: { url: string }) {
  const { dictionary } = useI18n()

  return (
    <div
      aria-label={dictionary.share.qrAria}
      className="mx-auto w-fit rounded-lg bg-white p-3"
      role="img"
    >
      <QRCodeSVG value={url} size={192} level="M" bgColor="#ffffff" fgColor="#000000" />
    </div>
  )
}
