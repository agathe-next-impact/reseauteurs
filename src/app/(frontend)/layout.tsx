import React, { Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Inter, Inter_Tight } from 'next/font/google'
import { Toaster } from 'sonner'
import AuthProvider from '@/components/nav/AuthProvider'
import AuthNav from '@/components/nav/AuthNav'
import MobileNavReseauteurs from '@/components/nav/MobileNavReseauteurs'
import BottomNavReseauteurs from '@/components/nav/BottomNavReseauteurs'
import RouteProgressBar from '@/components/nav/RouteProgressBar'
import ScrollToTop from '@/components/nav/ScrollToTop'
import FooterReseauteurs from '@/components/nav/FooterReseauteurs'
import AgencyCreditBanner from '@/components/nav/AgencyCreditBanner'
import ThemeToggle from '@/components/nav/ThemeToggle'
import CookieInfoBanner from '@/components/legal/CookieInfoBanner'
import ServiceWorkerRegistrar from '@/components/pwa/ServiceWorkerRegistrar'
import InstallPWABanner from '@/components/pwa/InstallPWABanner'
import GoogleAnalytics from '@/components/seo/GoogleAnalytics'
import { JsonLd } from '@/components/seo/JsonLd'
import { buildRootMetadata, buildRootViewport } from '@/lib/seo'
import { buildOrganizationJsonLd, buildWebSiteJsonLd } from '@/lib/jsonld'
import { SITE_NAME, SITE_TAGLINE } from '@/lib/site'
import { PUBLIC_NAV_LINKS } from '@/lib/public-nav'
import './styles.css'

// Jeu typographique « institution neutre » : Inter pour le corps et l'UI,
// Inter Tight (compagnon resserré, dessiné pour le display) pour les titres.
// `weight` omis → next/font sert la VARIABLE font : toutes les graisses
// (400→800 utilisées ici) pour le poids d'un seul fichier par famille.
// Le subset `latin` de Google couvre U+0152-0153, donc « œ » (cœur, œuvre)
// est inclus : pas besoin de `latin-ext`.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const interTight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-inter-tight',
  display: 'swap',
})

export const metadata = buildRootMetadata()
export const viewport = buildRootViewport()

export default function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  // ISR/statique : PAS de headers()/payload.auth() ici (cela basculait TOUTE route
  // `(frontend)` en dynamique et annulait l'ISR — audit perf P1). L'état auth de la nav
  // est hydraté côté client par AuthProvider (GET /api/auth/me).
  return (
    <html lang="fr" className={`${inter.variable} ${interTight.variable}`} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://js.stripe.com" />
        {/* CDN cartes : connexion TLS prête avant le style/glyphes/tuiles MapLibre
            (la vue carte est la vue par défaut de /reseauteurs et /evenements). */}
        <link rel="preconnect" href="https://tiles.openfreemap.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://basemaps.cartocdn.com" />
      </head>
      <body suppressHydrationWarning className="font-[family-name:var(--font-inter)] overflow-x-hidden antialiased">
        {/* Thème : clair par défaut. Ré-applique le mode sombre choisi AVANT
            peinture pour éviter le flash (FOUC). Script parser-bloquant en
            tête de <body> : document.body existe déjà à son exécution. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{document.documentElement.classList.add('js-ready');if(localStorage.getItem('reseauteurs-theme')==='dark')document.body.classList.add('ir-plasma');}catch(e){}})();",
          }}
        />
        <JsonLd data={[buildOrganizationJsonLd(), buildWebSiteJsonLd()]} />

        <AuthProvider>
        {/* En-tête principal */}
        <header className="ir-plasma-header min-h-16 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-50">
          <Link
            href="/"
            className="ir-plasma-brand font-bold text-lg no-underline inline-flex items-center gap-2 py-2"
            aria-label={`Accueil ${SITE_NAME}`}
          >
            <Image
              src="/img/logo.png"
              alt=""
              width={40}
              height={40}
              priority
              className="h-9 w-9 flex-none"
              aria-hidden
            />
            <span className="text-xl font-extrabold tracking-tight">
              {SITE_NAME.toUpperCase()}
            </span>
            <span className="hidden xl:inline whitespace-nowrap text-xs font-medium border-l pl-2 ml-1">
              {SITE_TAGLINE}
            </span>
          </Link>

          {/* Nav desktop dès lg (1024px) : en dessous, logo+liens+auth ne tiennent pas
              dans la largeur (débordement 640–900px constaté). Les 4 liens publics
              passent alors dans la barre basse (BottomNavReseauteurs), le hamburger
              ne gardant que l'espace membre. */}
          <nav className="flex items-center gap-1 lg:gap-5" aria-label="Navigation principale">
            {PUBLIC_NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="ir-plasma-nav-link text-sm no-underline transition-colors hidden lg:inline font-medium"
              >
                {label}
              </Link>
            ))}
            <ThemeToggle />
            <div className="hidden lg:flex">
              <AuthNav />
            </div>
            <MobileNavReseauteurs />
          </nav>
        </header>

        <Suspense>
          <RouteProgressBar />
        </Suspense>
        <Suspense>
          <ScrollToTop />
        </Suspense>

        <main>{children}</main>

        <AgencyCreditBanner />
        <FooterReseauteurs />
        <BottomNavReseauteurs />
        <CookieInfoBanner />
        {/* PWA — le SW inerte rend Chrome/Edge éligibles à `beforeinstallprompt` ;
            la bannière lit `useSearchParams` (vue=carte), d'où le Suspense. */}
        <ServiceWorkerRegistrar />
        <Suspense>
          <InstallPWABanner />
        </Suspense>
        <Toaster
          position="bottom-right"
          toastOptions={{ style: { fontFamily: 'inherit' } }}
          richColors
          closeButton
        />
        <GoogleAnalytics />
        </AuthProvider>
      </body>
    </html>
  )
}
