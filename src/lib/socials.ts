export type SocialPlatform = 'facebook' | 'instagram' | 'linkedin' | 'twitter' | 'youtube' | 'tiktok' | 'pinterest'

export interface SocialLinkData {
  plateforme: SocialPlatform
  url: string
}

export const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  facebook:  'Facebook',
  instagram: 'Instagram',
  linkedin:  'LinkedIn',
  twitter:   'X (Twitter)',
  youtube:   'YouTube',
  tiktok:    'TikTok',
  pinterest: 'Pinterest',
}

export const SOCIAL_COLORS: Record<SocialPlatform, string> = {
  facebook:  '#1877F2',
  instagram: '#E4405F',
  linkedin:  '#0A66C2',
  twitter:   '#000000',
  youtube:   '#FF0000',
  tiktok:    '#000000',
  pinterest: '#BD081C',
}

/**
 * Extract a display handle from a social URL.
 * e.g. "https://instagram.com/foobar" → "@foobar"
 */
export function socialHandle(url: string): string {
  try {
    const { pathname } = new URL(url)
    const handle = pathname.replace(/^\/+|\/+$/g, '').split('/')[0]
    if (handle) return `@${handle}`
  } catch { /* ignore */ }
  return url.replace(/^https?:\/\//, '')
}
