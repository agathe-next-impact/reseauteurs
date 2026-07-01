import { SITE_URL, SITE_NAME, CONTACT_EMAIL } from '../site'
import { emailTheme } from './theme'
import { generateUnsubscribeToken } from './tokens'

const COMPANY_LINE = `${SITE_NAME} — Annuaire B2B des revendeurs d'objets publicitaires`

function legalLinks(): string {
  const linkStyle = `color:${emailTheme.color.textMuted};text-decoration:underline`
  return `
    <a href="${SITE_URL}/mentions-legales" style="${linkStyle}">Mentions legales</a>
    &middot;
    <a href="${SITE_URL}/confidentialite" style="${linkStyle}">Confidentialité</a>
    &middot;
    <a href="${SITE_URL}/contact" style="${linkStyle}">Contact</a>`
}

export function footerTransactional(): string {
  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:24px 0 0 0">
    <tr>
      <td style="padding:16px 0 0 0;border-top:1px solid ${emailTheme.color.borderMuted};text-align:center;font-family:${emailTheme.font.sans};font-size:12px;line-height:1.6;color:${emailTheme.color.textSubtle}">
        <p style="margin:0 0 6px 0">${COMPANY_LINE}</p>
        <p style="margin:0 0 6px 0">${legalLinks()}</p>
        <p style="margin:0">Une question ? Répondez à cet email ou ecrivez a <a href="mailto:${CONTACT_EMAIL}" style="color:${emailTheme.color.textMuted};text-decoration:underline">${CONTACT_EMAIL}</a>.</p>
      </td>
    </tr>
  </table>`
}

export function footerMarketing(userId: number | string): string {
  const token = generateUnsubscribeToken(userId)
  const unsubscribeUrl = `${SITE_URL}/api/emails/unsubscribe?token=${encodeURIComponent(token)}`
  const linkStyle = `color:${emailTheme.color.textMuted};text-decoration:underline`
  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:24px 0 0 0">
    <tr>
      <td style="padding:16px 0 0 0;border-top:1px solid ${emailTheme.color.borderMuted};text-align:center;font-family:${emailTheme.font.sans};font-size:12px;line-height:1.6;color:${emailTheme.color.textSubtle}">
        <p style="margin:0 0 6px 0">${COMPANY_LINE}</p>
        <p style="margin:0 0 6px 0">${legalLinks()}</p>
        <p style="margin:0 0 10px 0">Vous recevez cet email parce que vous avez accepté les emails d'information lors de votre inscription.</p>
        <p style="margin:0">
          <a href="${unsubscribeUrl}" style="${linkStyle}">Se désabonner en un clic</a>
          &middot;
          <a href="${SITE_URL}/dashboard/compte" style="${linkStyle}">Gérer mes préférences</a>
        </p>
      </td>
    </tr>
  </table>`
}
