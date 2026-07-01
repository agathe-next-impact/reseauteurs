import type { Metadata } from 'next'
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

  const images: OgImageInput[] = input.images && input.images.length > 0
    ? input.images.map((img) => ({
        url: absoluteUrl(img.url),
        width: img.width,
        height: img.height,
        alt: img.alt ?? title,
      }))
    : [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME }]

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
      images,
      ...(input.publishedTime && { publishedTime: input.publishedTime }),
      ...(input.modifiedTime && { modifiedTime: input.modifiedTime }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: images.map((img) => img.url),
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
    icons: {
      icon: '/icon.png',
    },
    formatDetection: { telephone: false, email: false, address: false },
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
