export function shouldTrackPageview(pathname: string | null): boolean {
  return pathname !== null && !pathname.startsWith("/share/")
}
