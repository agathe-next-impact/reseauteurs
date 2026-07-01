import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const isDev = process.env.NODE_ENV !== 'production'
// Domaine canonique RÉSEAUTEURS (rebranding J3). 'self' couvre déjà l'origine de
// service ; ces entrées CSP autorisent explicitement le domaine de production.
const siteSources = 'https://reseauteurs.fr https://www.reseauteurs.fr'

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Mapbox retiré (ADR-0006 : MapLibre GL JS + tuiles OSM — aucun token tiers requis)
      `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''} ${siteSources} https://js.stripe.com https://www.googletagmanager.com https://*.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com`,
      `script-src-elem 'self' 'unsafe-inline' ${siteSources} https://js.stripe.com https://www.googletagmanager.com https://*.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com`,
      // MapLibre injecte des styles inline — 'unsafe-inline' suffit (pas de Mapbox CDN)
      `style-src 'self' 'unsafe-inline' ${siteSources}`,
      `style-src-elem 'self' 'unsafe-inline' ${siteSources}`,
      // Tuiles OSM : openstreetmap.org + OpenFreeMap CDN (styles liberty, tuiles vectorielles)
      `img-src 'self' data: blob: ${siteSources} https://*.tile.openstreetmap.org https://*.openstreetmap.org https://tiles.openfreemap.org https://*.openfreemap.org https://*.basemaps.cartocdn.com https://*.public.blob.vercel-storage.com https://*.google-analytics.com https://*.googletagmanager.com`,
      // Glyphes / polices carte servies par OpenFreeMap
      "font-src 'self' https://tiles.openfreemap.org https://*.openfreemap.org",
      // Web workers MapLibre (bundlés en blob: via Next.js)
      "worker-src 'self' blob:",
      // connect-src : styles + tuiles OpenFreeMap, géocodage data.gouv, Stripe, Analytics
      "connect-src 'self' https://api.stripe.com https://api-adresse.data.gouv.fr https://*.tile.openstreetmap.org https://*.openstreetmap.org https://tiles.openfreemap.org https://*.openfreemap.org https://*.basemaps.cartocdn.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com https://www.youtube-nocookie.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  serverExternalPackages: ['sharp'],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      ...(process.env.NEXT_PUBLIC_SITE_URL
        ? [
            {
              protocol: 'https' as const,
              hostname: new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname,
            },
          ]
        : []),
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'react-day-picker'],
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes except Payload admin
        source: '/((?!admin).*)',
        headers: securityHeaders,
      },
      {
        // Payload admin needs more permissive CSP (inline scripts, etc.)
        source: '/admin/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
  async redirects() {
    return [
      // ── Domaine legacy ───────────────────────────────────────────────────────
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.panorama-pub.com' }],
        destination: 'https://panorama-pub.com/:path*',
        permanent: true,
      },

      // ── Redirections 301 PanoramaPub → RÉSEAUTEURS (ADR-0005 capital SEO) ───
      // L'annuaire de revendeurs PanoramaPub est remplacé par la plateforme
      // RÉSEAUTEURS ; pas d'équivalent 1-pour-1 des fiches fournisseurs.
      {
        source: '/revendeurs',
        destination: '/reseauteurs',
        permanent: true,
      },
      {
        source: '/revendeurs/:slug*',
        destination: '/reseauteurs',
        permanent: true,
      },
      // /organisateurs → /reseaux (les organisateurs d'événements sont des réseaux dans le nouveau modèle)
      {
        source: '/organisateurs',
        destination: '/reseaux',
        permanent: true,
      },
      {
        source: '/organisateurs/:slug',
        destination: '/reseaux',
        permanent: true,
      },
      // ── Redirections seo-engineer (J2.D) — activées ici pour garantir un vrai 301
      // (les pages legacy /evenements/[slug] et /faq-revendeurs utilisent
      // permanentRedirect() = 308 ; ce bloc next.config.ts s'exécute à l'edge
      // avant le rendu des pages et produit un HTTP 301, plus universel pour les
      // crawlers legacy. Les fichiers page.tsx restent comme code mort jusqu'au
      // nettoyage J3 — ils ne seront jamais atteints quand cette règle matche).
      {
        source: '/evenements/:slug',
        destination: '/evenement/:slug',
        permanent: true,
      },
      {
        source: '/faq-revendeurs',
        destination: '/partenaires',
        permanent: true,
      },

      // ── ADR-0012 §7 — Pages à bascules : /carte/* → bascules (seo-engineer E2.D)
      // Les anciennes URLs de carte autonome redirigent vers les landing pages à
      // bascules avec la vue carte pré-sélectionnée. Les pages page.tsx sous
      // /carte/ restent (code mort — nettoyage E3) ; cette règle d'edge les court-
      // circuite en HTTP 301 avant même que Next.js ne charge le composant.
      {
        source: '/carte/reseauteurs',
        destination: '/reseauteurs?vue=carte',
        permanent: true,
      },
      {
        source: '/carte/evenements',
        destination: '/evenements?vue=carte',
        permanent: true,
      },
    ]
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
