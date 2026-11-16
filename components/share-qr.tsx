"use client"

import { QRCodeSVG } from "qrcode.react"

export function ShareQr({ url }: { url: string }) {
  return (
    <div
      aria-label="QR code for the share link"
      className="mx-auto w-fit rounded-lg bg-white p-3"
      role="img"
    >
      <QRCodeSVG value={url} size={192} level="M" bgColor="#ffffff" fgColor="#000000" />
    </div>
  )
}
