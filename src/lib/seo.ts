import type { Metadata, Viewport } from 'next'
import {
  SITE_URL,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_DESCRIPTION,
  SITE_LOCALE,
  DEFAULT_OG_IMAGE,
} from './site'
import { truncateDescription, truncateTitle } from './seo-text'

export type OgType = 'website' | 'article' | 'profile'

export type OgImageInput = {
  url: string
  width?: number
  height?: number
  alt?: string
}

export type BuildMetadataInput = {
  title: string
  description: string
  path: string
  ogType?: OgType
  images?: OgImageInput[]
  noindex?: boolean
  publishedTime?: string
  modifiedTime?: string
  keywords?: string[]
  /**
   * La route fournit sa propre image OG via la convention Next `opengraph-image.tsx`
   * (fiches réseauteur/événement/réseau). Dans ce cas on N'ÉMET PAS d'`og:image` par
   * défaut : Next injecte déjà celle du fichier, en émettre une seconde créerait deux
   * balises concurrentes. Une image explicite (`images`, ex. override SEO) reste
   * prioritaire si elle est fournie.
   */
  ogImageFromRoute?: boolean
}

function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const p = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return `${SITE_URL}${p}`
}

export function buildMetadata(input: BuildMetadataInput): Metadata {
  const title = truncateTitle(input.title)
  const description = truncateDescription(input.description)
  const canonical = absoluteUrl(input.path)

  // Image explicite (override SEO) → prioritaire. Sinon : image par défaut du site,
  // SAUF si la route fournit la sienne (opengraph-image.tsx) — alors `null`, on
  // laisse Next injecter cette unique image plutôt que d'en émettre une concurrente.
  const explicitImages: OgImageInput[] | null =
    input.images && input.images.length > 0
      ? input.images.map((img) => ({
          url: absoluteUrl(img.url),
          width: img.width,
          height: img.height,
          alt: img.alt ?? title,
        }))
      : null
  const images: OgImageInput[] | null =
    explicitImages ??
    (input.ogImageFromRoute
      ? null
      : [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME }])

  const robots = input.noindex
    ? { index: false, follow: false, googleBot: { index: false, follow: false } }
    : { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' as const, 'max-snippet': -1, 'max-video-preview': -1 } }

  return {
    title,
    description,
    alternates: { canonical },
    robots,
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      type: input.ogType === 'article' ? 'article' : input.ogType === 'profile' ? 'profile' : 'website',
      // images omis quand la route fournit son image (Next l'injecte via le fichier).
      ...(images && { images }),
      ...(input.publishedTime && { publishedTime: input.publishedTime }),
      ...(input.modifiedTime && { modifiedTime: input.modifiedTime }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      // Absente ici → Twitter retombe sur og:image (celle de la route). summary_large_image conservé.
      ...(images && { images: images.map((img) => img.url) }),
    },
    ...(input.keywords && input.keywords.length > 0 && { keywords: input.keywords }),
  }
}

export function buildRootMetadata(): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${SITE_NAME} — ${SITE_TAGLINE}`,
      template: `%s | ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    authors: [{ name: SITE_NAME, url: SITE_URL }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    alternates: { canonical: SITE_URL },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph: {
      type: 'website',
      locale: SITE_LOCALE,
      url: SITE_URL,
      siteName: SITE_NAME,
      title: `${SITE_NAME} — ${SITE_TAGLINE}`,
      description: SITE_DESCRIPTION,
      images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${SITE_NAME} — ${SITE_TAGLINE}`,
      description: SITE_DESCRIPTION,
      images: [DEFAULT_OG_IMAGE],
    },
    // Les favicons sont fournis par les conventions de fichiers Next.js
    // (src/app/icon.svg + icon.png + apple-icon.png) → balises <link> auto-générées.
    // Le manifeste l'est aussi (src/app/manifest.ts → <link rel="manifest">).
    appleWebApp: {
      capable: true,
      title: SITE_NAME,
      // 'default' : barre d'état opaque, texte sombre — cohérent avec le thème clair.
      // 'black-translucent' ferait passer le contenu SOUS la barre d'état, ce qui
      // exigerait de gérer env(safe-area-inset-top) dans l'en-tête collant.
      statusBarStyle: 'default',
    },
    other: {
      // `appleWebApp.capable` n'émet plus, depuis Next 15, que la balise
      // standardisée `mobile-web-app-capable` — qu'iOS n'interprète pas. iOS ≥ 16.4
      // ouvre en plein écran grâce au `display: standalone` du manifeste, mais les
      // versions antérieures ne s'appuient QUE sur cette balise historique.
      'apple-mobile-web-app-capable': 'yes',
    },
    formatDetection: { telephone: false, email: false, address: false },
  }
}

/**
 * Viewport racine — exporté par le layout `(frontend)`.
 *
 * `themeColor` colore la barre système en mode installé (et la barre d'URL sur
 * Chrome Android). Valeur unique, alignée sur le thème CLAIR : le mode sombre du
 * site est un choix explicite en localStorage, pas `prefers-color-scheme`, donc une
 * variante `media` se désynchroniserait des utilisateurs ayant basculé à la main.
 *
 * `viewportFit` reste au défaut ('auto') : le contenu n'est pas étendu sous les
 * encoches. Passer à 'cover' imposerait d'ajouter env(safe-area-inset-top) à
 * l'en-tête collant, sous peine de le voir passer sous la barre d'état iOS.
 */
export function buildRootViewport(): Viewport {
  return {
    width: 'device-width',
    initialScale: 1,
    themeColor: '#FFFFFF',
    colorScheme: 'light',
  }
}

type SeoOgImage =
  | number
  | null
  | {
      id?: number | string
      url?: string | null
      alt?: string | null
      width?: number | null
      height?: number | null
      sizes?: {
        full?: { url?: string | null; width?: number | null; height?: number | null } | null
        card?: { url?: string | null; width?: number | null; height?: number | null } | null
      } | null
    }

export type SeoFieldInput = {
  title?: string | null
  description?: string | null
  keywords?: string | null
  noindex?: boolean | null
  ogImage?: SeoOgImage | null
}

function extractOgImage(og: SeoOgImage | null | undefined): OgImageInput | null {
  if (!og || typeof og !== 'object') return null
  const full = og.sizes?.full
  const url = full?.url ?? og.url ?? null
  if (!url) return null
  return {
    url,
    width: full?.width ?? og.width ?? undefined,
    height: full?.height ?? og.height ?? undefined,
    alt: og.alt ?? undefined,
  }
}

/**
 * Applies the editorial overrides from a `seo.*` field group on top of defaults
 * derived from the entity itself. Empty overrides fall back to defaults.
 */
export function applySeoOverrides(
  defaults: BuildMetadataInput,
  overrides: SeoFieldInput | null | undefined,
): BuildMetadataInput {
  if (!overrides) return defaults
  const keywords = overrides.keywords
    ? overrides.keywords.split(',').map((k) => k.trim()).filter(Boolean)
    : defaults.keywords

  const overrideImage = extractOgImage(overrides.ogImage)
  const images: OgImageInput[] = overrideImage ? [overrideImage] : (defaults.images ?? [])

  return {
    ...defaults,
    title: overrides.title?.trim() ? overrides.title : defaults.title,
    description: overrides.description?.trim() ? overrides.description : defaults.description,
    noindex: overrides.noindex ?? defaults.noindex,
    keywords,
    images,
  }
}
