import { SITE_URL, SITE_NAME, SITE_TAGLINE } from '../site'
import { emailTheme, accentColors, type Accent } from './theme'
import { esc } from './esc'
import { footerMarketing, footerTransactional } from './footer'

export type FooterKind =
  | 'transactional'
  | { kind: 'marketing'; userId: number | string }

export interface RenderEmailOptions {
  preheader?: string
  heading: string
  intro?: string
  content: string
  footer: FooterKind
  accent?: Accent
  /** Overrides the document <title>. Defaults to the heading. */
  title?: string
}

function headStyles(accent: Accent): string {
  const { bar } = accentColors(accent)
  return `
  <style>
    /* Reset */
    body,table,td,a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table,td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; display:block; }
    body { margin:0 !important; padding:0 !important; width:100% !important; background:${emailTheme.color.bgPage}; }
    a { color:${emailTheme.color.primary}; }

    /* Mobile */
    @media only screen and (max-width:600px) {
      .wrap { width:100% !important; padding:0 !important; }
      .card { padding:20px !important; border-radius:0 !important; }
      .h1 { font-size:22px !important; line-height:1.3 !important; }
      .btn a { display:block !important; width:100% !important; box-sizing:border-box !important; }
    }

    /* Dark mode — dark band #0C1219 + surfaces zinc (identité RÉSEAUTEURS) */
    @media (prefers-color-scheme: dark) {
      body { background:#0C1219 !important; }
      .page-bg { background:#0C1219 !important; }
      .card { background:#1D1E21 !important; color:#E9E9EA !important; }
      .h1, .body-text, .intro { color:#E9E9EA !important; }
      .text-muted { color:#CFD0D2 !important; }
      .divider, .info-row, .info-row-border { border-color:#3F4247 !important; }
      .footer { color:#999A9D !important; border-color:#3F4247 !important; }
      .footer a { color:#CFD0D2 !important; }
      .accent-bar { background:${bar} !important; }
    }
  </style>
  <!--[if mso]>
    <style>
      td, a, span { font-family:Arial, Helvetica, sans-serif !important; }
    </style>
  <![endif]-->`
}

function preheaderBlock(preheader: string | undefined): string {
  if (!preheader) return ''
  const safe = esc(preheader)
  // Hidden preview text + trailing invisible chars to prevent clients from
  // pulling additional body text into the preview snippet.
  return `
  <div style="display:none;max-height:0;max-width:0;overflow:hidden;mso-hide:all;visibility:hidden;opacity:0;color:transparent;height:0;width:0;font-size:1px;line-height:1px">
    ${safe}${'&zwnj;&nbsp;'.repeat(50)}
  </div>`
}

function renderFooter(footer: FooterKind): string {
  if (footer === 'transactional') return footerTransactional()
  return footerMarketing(footer.userId)
}

/**
 * Build the main HTML email. Table-based, 600px centered, with accent bar,
 * logo, card body, and footer. Preheader is hidden preview text for Gmail.
 */
export function renderEmail(opts: RenderEmailOptions): string {
  const accent: Accent = opts.accent ?? 'primary'
  const { bar, heading: headingColor } = accentColors(accent)
  const titleText = esc(opts.title ?? opts.heading)
  const headingText = esc(opts.heading)
  const intro = opts.intro
    ? `<p class="intro" style="margin:0 0 16px 0;font-family:${emailTheme.font.sans};font-size:16px;line-height:1.55;color:${emailTheme.color.textMedium}">${esc(opts.intro)}</p>`
    : ''
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${titleText}</title>
  ${headStyles(accent)}
</head>
<body class="page-bg" style="margin:0;padding:0;background:${emailTheme.color.bgPage};font-family:${emailTheme.font.sans};color:${emailTheme.color.textDark}">
  ${preheaderBlock(opts.preheader)}
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="page-bg" style="background:${emailTheme.color.bgPage}">
    <tr>
      <td align="center" style="padding:24px 12px">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="wrap" style="width:600px;max-width:600px">
          <tr>
            <td align="center" style="padding:0 0 20px 0">
              <a href="${SITE_URL}" target="_blank" style="text-decoration:none;border:0;outline:none;color:${emailTheme.color.textDark}">
                <span class="h1" style="font-family:${emailTheme.font.sans};font-size:26px;font-weight:800;letter-spacing:0.5px;color:${emailTheme.color.textDark};line-height:1;text-transform:uppercase">${esc(SITE_NAME)}</span>
              </a>
              <div class="text-muted" style="font-family:${emailTheme.font.sans};font-size:12px;font-weight:500;letter-spacing:0.2px;color:${emailTheme.color.textMuted};margin-top:6px">${esc(SITE_TAGLINE)}</div>
            </td>
          </tr>
          <tr>
            <td class="accent-bar" style="background:${bar};height:4px;font-size:4px;line-height:4px;border-radius:6px 6px 0 0">&nbsp;</td>
          </tr>
          <tr>
            <td class="card" style="background:${emailTheme.color.bgCard};border:1px solid ${emailTheme.color.borderLight};border-top:0;border-radius:0 0 8px 8px;padding:32px">
              <h1 class="h1" style="margin:0 0 16px 0;font-family:${emailTheme.font.sans};font-size:24px;line-height:1.3;color:${headingColor};font-weight:700">${headingText}</h1>
              ${intro}
              <div class="body-text" style="font-family:${emailTheme.font.sans};font-size:15px;line-height:1.6;color:${emailTheme.color.textMedium}">
                ${opts.content}
              </div>
              <p class="body-text" style="margin:24px 0 0 0;font-family:${emailTheme.font.sans};font-size:15px;line-height:1.6;color:${emailTheme.color.textMedium}">
                L'équipe ${esc(SITE_NAME)}
              </p>
            </td>
          </tr>
          <tr>
            <td class="footer" style="padding:0 8px">
              ${renderFooter(opts.footer)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
