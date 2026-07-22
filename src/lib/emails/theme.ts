/**
 * Tokens visuels des emails — alignés sur l'identité RÉSEAUTEURS
 * (source : .claude/design/DESIGN.md et src/app/(frontend)/styles.css).
 *
 *   Canvas #F2F2F2 · bleu de marque #035AA6 · orange conversion/CTA #F5E050
 *   navy #012A4A (titres) · neutres zinc · bordure #DFE0E1 · dark band #0C1219
 */
export const emailTheme = {
  color: {
    primary: '#035AA6', // bleu de marque
    primaryHover: '#02467F',
    primaryLight: '#EFF5FA', // tint bleu clair (cards highlight, code, encarts)
    bgPage: '#F2F2F2', // canvas clair
    bgCard: '#FFFFFF',
    textDark: '#012A4A', // navy — titres
    textMedium: '#3F4247', // zinc-700 — corps
    textMuted: '#6E7175', // zinc-500
    textSubtle: '#999A9D', // zinc-400
    border: '#DFE0E1', // zinc-200
    borderLight: '#DFE0E1',
    borderMuted: '#DFE0E1',
    // « premium » = orange de conversion (mise en avant / CTA fort — cf. DESIGN.md)
    premiumFrom: '#F5E050',
    premiumTo: '#8A6D0B',
    danger: '#DC2626',
    dangerBg: '#FEF2F2',
    dangerBorder: '#FECACA',
    success: '#059669',
    successBg: '#ECFDF5',
    successBorder: '#A7F3D0',
    warning: '#B45309',
    warningBg: '#FFFBEB',
    warningBorder: '#FDE68A',
    info: '#035AA6',
    infoBg: '#EFF5FA',
    infoBorder: '#A9C9E4',
  },
  font: {
    // Inter en tête (rendu on-brand là où la police est disponible),
    // repli sur la stack système — les clients email ne chargent pas de webfont.
    sans: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
  },
  radius: { sm: '4px', md: '6px', lg: '8px' },
  spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px' },
  fontSize: {
    xs: '12px',
    sm: '14px',
    md: '16px',
    lg: '18px',
    xl: '22px',
    xxl: '26px',
  },
} as const

export type Accent = 'primary' | 'premium' | 'danger' | 'neutral' | 'success'

export function accentColors(accent: Accent): { bar: string; heading: string } {
  switch (accent) {
    case 'premium':
      // Barre orange + titre orange foncé (mise en avant / conversion)
      return { bar: emailTheme.color.premiumFrom, heading: emailTheme.color.premiumTo }
    case 'danger':
      return { bar: emailTheme.color.danger, heading: emailTheme.color.danger }
    case 'success':
      return { bar: emailTheme.color.success, heading: emailTheme.color.success }
    case 'neutral':
      return { bar: emailTheme.color.textDark, heading: emailTheme.color.textDark }
    case 'primary':
    default:
      // Barre bleu de marque + titre navy
      return { bar: emailTheme.color.primary, heading: emailTheme.color.textDark }
  }
}
