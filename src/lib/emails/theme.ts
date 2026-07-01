export const emailTheme = {
  color: {
    primary: '#EDA82F',
    primaryHover: '#eda21f',
    primaryLight: '#fff3d4',
    bgPage: '#fff7e0',
    bgCard: '#ffffff',
    textDark: '#000000',
    textMedium: '#262522',
    textMuted: '#6b7280',
    textSubtle: '#9ca3af',
    border: '#EDA82F',
    borderLight: '#ebb92f',
    borderMuted: '#e5e7eb',
    premiumFrom: '#b45309',
    premiumTo: '#92400e',
    danger: '#dc2626',
    dangerBg: '#fef2f2',
    dangerBorder: '#fecaca',
    success: '#059669',
    successBg: '#ecfdf5',
    successBorder: '#a7f3d0',
    warning: '#b45309',
    warningBg: '#fff3d4',
    warningBorder: '#ebb92f',
    info: '#1d4ed8',
    infoBg: '#eff6ff',
    infoBorder: '#bfdbfe',
  },
  font: {
    sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
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
      return { bar: emailTheme.color.premiumFrom, heading: emailTheme.color.premiumTo }
    case 'danger':
      return { bar: emailTheme.color.danger, heading: emailTheme.color.danger }
    case 'success':
      return { bar: emailTheme.color.success, heading: emailTheme.color.success }
    case 'neutral':
      return { bar: emailTheme.color.textMedium, heading: emailTheme.color.textDark }
    case 'primary':
    default:
      return { bar: emailTheme.color.primary, heading: emailTheme.color.textDark }
  }
}
