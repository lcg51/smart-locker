export type AuthNoticeKey = "link" | "send" | "unavailable"

// Auth.js reports failures with its own codes. Keep the copy neutral: it must
// not reveal whether an address is on the invite list.
const LINK_FAILURES = new Set(["not_invited", "AccessDenied", "Verification"])

export function authNoticeKey(error: string | null | undefined): AuthNoticeKey | null {
  if (!error) return null
  // A thrown Resend/provider failure becomes `Configuration` at the error page;
  // that is a delivery failure, not a stale or invalid link.
  if (error === "Configuration") return "send"
  return LINK_FAILURES.has(error) ? "link" : "unavailable"
}
