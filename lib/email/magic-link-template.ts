import type { Locale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { fill } from "@/lib/i18n/format"

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function renderMagicLinkEmail({
  url,
  locale,
}: {
  url: string
  locale: Locale
}): { subject: string; html: string; text: string } {
  const dictionary = getDictionary(locale)
  const email = dictionary.email
  const href = escapeHtml(url)
  const text = fill(email.signInBody, { url })

  const html = `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(email.signInSubject)}</title>
<style>
@media (prefers-color-scheme: dark) {
  .email-body { background-color: #0b0f19 !important; }
  .email-card { background-color: #111827 !important; border-color: #374151 !important; }
  .email-text { color: #e5e7eb !important; }
  .email-muted { color: #9ca3af !important; }
  .email-link { color: #d1d5db !important; }
  .email-shell { background-color: #0b0f19 !important; }
  .email-button { background-color: #f9fafb !important; color: #111827 !important; }
}
</style>
</head>
<body class="email-body" style="margin:0;padding:0;background-color:#f3f4f6;">
  <table role="presentation" class="email-shell" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" class="email-card" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
          <tr>
            <td style="padding:32px;">
              <p class="email-muted" style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.4;font-weight:600;color:#6b7280;">Smart Locker</p>
              <h1 class="email-text" style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:24px;line-height:1.3;font-weight:600;color:#111827;">${escapeHtml(email.signInHeading)}</h1>
              <p class="email-text" style="margin:0 0 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#374151;">${escapeHtml(email.signInIntro)}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center" bgcolor="#111827" style="border-radius:8px;">
                    <a class="email-button" href="${href}" style="display:inline-block;padding:14px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.2;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(email.signInButton)}</a>
                  </td>
                </tr>
              </table>
              <p class="email-muted" style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#6b7280;">${escapeHtml(email.signInFallback)}</p>
              <p class="email-link" style="margin:0 0 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;word-break:break-all;"><a class="email-link" href="${href}" style="color:#374151;">${href}</a></p>
              <p class="email-muted" style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#6b7280;">${escapeHtml(email.signInIgnore)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject: email.signInSubject, html, text }
}
