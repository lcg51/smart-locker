import type { MetadataRoute } from "next"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { getLocale } from "@/lib/i18n/server"

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const dictionary = getDictionary(await getLocale())

  return {
    name: dictionary.common.appName,
    short_name: dictionary.common.appName,
    description: dictionary.meta.manifestDescription,
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
