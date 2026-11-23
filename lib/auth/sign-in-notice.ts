export type AuthNoticeKey = "link" | "unavailable"

// Auth.js reports failures with its own codes. Keep the copy neutral: it must
// not reveal whether an address is on the invite list.
const LINK_FAILURES = new Set(["not_invited", "AccessDenied", "Verification", "Configuration"])

export function authNoticeKey(error: string | null | undefined): AuthNoticeKey | null {
  if (!error) return null
  return LINK_FAILURES.has(error) ? "link" : "unavailable"
}
