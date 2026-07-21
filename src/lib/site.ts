export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://reseauteurs.com'
export const SITE_DOMAIN = SITE_URL.replace(/^https?:\/\//, '')
export const SITE_NAME = 'Réseauteurs'
export const SITE_TAGLINE = 'La plateforme nationale du networking'
export const SITE_DESCRIPTION =
  'La plateforme qui rassemble tous les professionnels du networking, leurs événements et leurs réseaux d\'affaires.'
export const SITE_LOCALE = 'fr_FR'
export const SITE_LANG = 'fr'
export const SITE_COUNTRY = 'FR'
export const CONTACT_EMAIL = 'contact@reseauteurs.com'
export const DEFAULT_OG_IMAGE = `${SITE_URL}/opengraph-image`

/**
 * Réseaux sociaux officiels (affichés en pied de page).
 * ⚠️ Remplacez par les URLs réelles des comptes RÉSEAUTEURS.
 */
export const SOCIAL_LINKS = {
  instagram: 'https://www.instagram.com/reseauteurs',
  linkedin: 'https://www.linkedin.com/company/reseauteurs',
} as const
