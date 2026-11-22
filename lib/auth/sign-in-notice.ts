export const SIGN_IN_LINK_ERROR =
  "This sign-in link couldn’t be used. Check that you opened the latest link, or ask your building administrator if you were invited."

export const SIGN_IN_SEND_ERROR = "We couldn’t send the sign-in link. Try again in a moment."

export const SIGN_IN_EMAIL_ERROR = "Enter a valid email address."

export const SIGN_IN_UNAVAILABLE_ERROR = "Sign-in couldn’t be completed. Try again in a moment."

// Auth.js reports failures with its own codes. Keep the copy neutral: it must
// not reveal whether an address is on the invite list.
const LINK_FAILURES = new Set(["not_invited", "AccessDenied", "Verification", "Configuration"])

export function authNotice(error: string | null | undefined): string | null {
  if (!error) return null
  return LINK_FAILURES.has(error) ? SIGN_IN_LINK_ERROR : SIGN_IN_UNAVAILABLE_ERROR
}
