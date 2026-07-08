/**
 * Tokens visuels des emails — alignés sur l'identité RÉSEAUTEURS
 * (source : .claude/design/DESIGN.md et src/app/(frontend)/styles.css).
 *
 *   Canvas #faf9f5 · bleu de marque #2563EB · orange conversion/CTA #f5851f
 *   navy #16284f (titres) · neutres zinc · bordure #e4e4e7 · dark band #0d0d10
 */
export const emailTheme = {
  color: {
    primary: '#2563EB', // bleu de marque
    primaryHover: '#1D4ED8',
    primaryLight: '#EFF6FF', // tint bleu clair (cards highlight, code, encarts)
    bgPage: '#FAF9F5', // canvas clair
    bgCard: '#FFFFFF',
    textDark: '#16284F', // navy — titres
    textMedium: '#3F3F46', // zinc-700 — corps
    textMuted: '#71717A', // zinc-500
    textSubtle: '#A1A1AA', // zinc-400
    border: '#E4E4E7', // zinc-200
    borderLight: '#E4E4E7',
    borderMuted: '#E4E4E7',
    // « premium » = orange de conversion (mise en avant / CTA fort — cf. DESIGN.md)
    premiumFrom: '#F5851F',
    premiumTo: '#C2410C',
    danger: '#DC2626',
    dangerBg: '#FEF2F2',
    dangerBorder: '#FECACA',
    success: '#059669',
    successBg: '#ECFDF5',
    successBorder: '#A7F3D0',
    warning: '#B45309',
    warningBg: '#FFFBEB',
    warningBorder: '#FDE68A',
    info: '#2563EB',
    infoBg: '#EFF6FF',
    infoBorder: '#BFDBFE',
  },
  font: {
    // Hanken Grotesk en tête (rendu on-brand là où la police est disponible),
    // repli sur la stack système — les clients email ne chargent pas de webfont.
    sans: "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
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
