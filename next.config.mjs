/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === "development"

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js emits inline bootstrap/streaming scripts. A nonce-based policy is
  // out of scope for this task, so inline scripts are allowed; frame-ancestors
  // and the remaining directives still restrict embedding and sources.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ")

const commonHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
]

const noStoreHeaders = [
  { key: "Cache-Control", value: "no-store, max-age=0" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
]

const nextConfig = {
  images: { unoptimized: true },
  async headers() {
    return [
      { source: "/:path*", headers: commonHeaders },
      {
        source: "/share/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      { source: "/dashboard/:path*", headers: noStoreHeaders },
      { source: "/auth/:path*", headers: noStoreHeaders },
      { source: "/onboarding/:path*", headers: noStoreHeaders },
    ]
  },
}

export default nextConfig
