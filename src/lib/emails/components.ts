import { emailTheme } from './theme'
import { esc } from './esc'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'premium' | 'success'

export interface ButtonProps {
  href: string
  label: string
  variant?: ButtonVariant
}

function buttonColors(variant: ButtonVariant): { bg: string; border: string; text: string } {
  switch (variant) {
    case 'secondary':
      return { bg: '#ffffff', border: emailTheme.color.primary, text: emailTheme.color.textDark }
    case 'danger':
      return { bg: emailTheme.color.danger, border: emailTheme.color.danger, text: '#ffffff' }
    case 'premium':
      return { bg: emailTheme.color.premiumFrom, border: emailTheme.color.premiumFrom, text: '#ffffff' }
    case 'success':
      return { bg: emailTheme.color.success, border: emailTheme.color.success, text: '#ffffff' }
    case 'primary':
    default:
      return { bg: emailTheme.color.primary, border: emailTheme.color.primary, text: '#ffffff' }
  }
}

/**
 * Bulletproof button (VML fallback for Outlook + styled anchor for modern clients).
 * Renders à centered CTA.
 */
export function button({ href, label, variant = 'primary' }: ButtonProps): string {
  const { bg, border, text } = buttonColors(variant)
  const safeHref = esc(href)
  const safeLabel = esc(label)
  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:24px auto">
    <tr>
      <td align="center" style="border-radius:6px;background:${bg}">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:46px;v-text-anchor:middle;width:260px;" arcsize="13%" stroke="f" fillcolor="${bg}">
          <w:anchorlock/>
          <center style="color:${text};font-family:${emailTheme.font.sans};font-size:15px;font-weight:600;">${safeLabel}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-- -->
        <a href="${safeHref}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:${emailTheme.font.sans};font-size:15px;font-weight:600;line-height:20px;color:${text};text-decoration:none;background:${bg};border:1px solid ${border};border-radius:6px;mso-padding-alt:0;text-transform:none">${safeLabel}</a>
        <!--<![endif]-->
      </td>
    </tr>
  </table>`
}

export type CardVariant = 'default' | 'highlight' | 'warning' | 'success' | 'danger' | 'info'

export interface CardProps {
  title?: string
  body: string
  variant?: CardVariant
}

function cardColors(variant: CardVariant): { bg: string; border: string; title: string } {
  switch (variant) {
    case 'highlight':
      return { bg: emailTheme.color.primaryLight, border: emailTheme.color.primary, title: emailTheme.color.textDark }
    case 'warning':
      return { bg: emailTheme.color.warningBg, border: emailTheme.color.warningBorder, title: emailTheme.color.warning }
    case 'success':
      return { bg: emailTheme.color.successBg, border: emailTheme.color.successBorder, title: emailTheme.color.success }
    case 'danger':
      return { bg: emailTheme.color.dangerBg, border: emailTheme.color.dangerBorder, title: emailTheme.color.danger }
    case 'info':
      return { bg: emailTheme.color.infoBg, border: emailTheme.color.infoBorder, title: emailTheme.color.info }
    case 'default':
    default:
      return { bg: '#f9fafb', border: emailTheme.color.borderMuted, title: emailTheme.color.textDark }
  }
}

export function card({ title, body, variant = 'default' }: CardProps): string {
  const { bg, border, title: titleColor } = cardColors(variant)
  const titleBlock = title
    ? `<p style="margin:0 0 8px 0;font-family:${emailTheme.font.sans};font-size:15px;font-weight:600;color:${titleColor};line-height:1.4">${esc(title)}</p>`
    : ''
  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0">
    <tr>
      <td style="background:${bg};border:1px solid ${border};border-radius:6px;padding:16px 18px">
        ${titleBlock}
        <div style="font-family:${emailTheme.font.sans};font-size:15px;line-height:1.6;color:${emailTheme.color.textMedium}">${body}</div>
      </td>
    </tr>
  </table>`
}

export function divider(): string {
  return `<hr style="margin:24px 0;border:none;border-top:1px solid ${emailTheme.color.borderMuted}" />`
}

export interface InfoRow {
  label: string
  value: string
}

export function infoRow({ label, value }: InfoRow): string {
  return `
  <tr>
    <td style="padding:8px 0;font-family:${emailTheme.font.sans};font-size:14px;color:${emailTheme.color.textMuted};width:40%;vertical-align:top">${esc(label)}</td>
    <td style="padding:8px 0;font-family:${emailTheme.font.sans};font-size:14px;color:${emailTheme.color.textDark};font-weight:600;vertical-align:top">${esc(value)}</td>
  </tr>`
}

export function table(rows: InfoRow[]): string {
  const body = rows.map(infoRow).join('')
  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0;border-top:1px solid ${emailTheme.color.borderMuted};border-bottom:1px solid ${emailTheme.color.borderMuted}">
    ${body}
  </table>`
}

export type AlertTone = 'info' | 'warning' | 'danger' | 'success'

export function alertBox({ tone, text }: { tone: AlertTone; text: string }): string {
  const variant: CardVariant = tone === 'info' ? 'info' : tone
  return card({ body: `<p style="margin:0">${esc(text)}</p>`, variant })
}

export function codeBlock(code: string): string {
  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:20px auto">
    <tr>
      <td style="background:${emailTheme.color.primaryLight};border:1px solid ${emailTheme.color.borderLight};border-radius:6px;padding:12px 20px;font-family:${emailTheme.font.mono};font-size:18px;font-weight:600;color:${emailTheme.color.textDark};letter-spacing:1px">${esc(code)}</td>
    </tr>
  </table>`
}

export function paragraph(html: string): string {
  return `<p style="margin:0 0 12px 0;font-family:${emailTheme.font.sans};font-size:15px;line-height:1.6;color:${emailTheme.color.textMedium}">${html}</p>`
}

export function list(items: string[]): string {
  const lis = items
    .map(
      (item) =>
        `<li style="margin:0 0 6px 0;font-family:${emailTheme.font.sans};font-size:15px;line-height:1.6;color:${emailTheme.color.textMedium}">${item}</li>`,
    )
    .join('')
  return `<ul style="margin:8px 0 16px 0;padding-left:22px">${lis}</ul>`
}

/**
 * Fallback URL line shown under a CTA button so clients that strip links still work.
 */
export function fallbackUrl(url: string): string {
  const safe = esc(url)
  return `<p style="margin:8px 0 16px 0;font-family:${emailTheme.font.sans};font-size:12px;line-height:1.5;color:${emailTheme.color.textMuted};word-break:break-all">Lien direct : <a href="${safe}" style="color:${emailTheme.color.textMuted};text-decoration:underline">${safe}</a></p>`
}
