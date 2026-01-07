import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function proxy(request: NextRequest) {
  const isAuthenticated = request.cookies.get("authenticated")?.value === "true"
  const isAuthPage = request.nextUrl.pathname === "/auth"
  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard")

  console.log("[v0] Middleware - isAuthenticated:", isAuthenticated)

  // Redirect to auth if trying to access dashboard without authentication
  if (isDashboard && !isAuthenticated) {
    return NextResponse.redirect(new URL("/auth", request.url))
  }

  // Redirect to dashboard if already authenticated and on auth page
  if (isAuthPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth"],
}

