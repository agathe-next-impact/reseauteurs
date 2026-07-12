import React, { Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { Hanken_Grotesk } from 'next/font/google'
import { Toaster } from 'sonner'
import AuthNav from '@/components/nav/AuthNav'
import MobileNavReseauteurs from '@/components/nav/MobileNavReseauteurs'
import RouteProgressBar from '@/components/nav/RouteProgressBar'
import ScrollToTop from '@/components/nav/ScrollToTop'
import FooterReseauteurs from '@/components/nav/FooterReseauteurs'
import ThemeToggle from '@/components/nav/ThemeToggle'
import CookieInfoBanner from '@/components/legal/CookieInfoBanner'
import GoogleAnalytics from '@/components/seo/GoogleAnalytics'
import { JsonLd } from '@/components/seo/JsonLd'
import { buildRootMetadata } from '@/lib/seo'
import { buildOrganizationJsonLd, buildWebSiteJsonLd } from '@/lib/jsonld'
import { SITE_NAME, SITE_TAGLINE } from '@/lib/site'
import './styles.css'

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-hanken',
  display: 'swap',
})

export const metadata = buildRootMetadata()

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  const serializedUser = user ? { email: user.email ?? '', nomSociete: user.nomSociete ?? '' } : null

  const role: 'reseauteur' | 'organisateur' | 'admin' = user
    ? ((user.role as string) === 'organisateur'
      ? 'organisateur'
      : (user.role as string) === 'admin'
        ? 'admin'
        : 'reseauteur')
    : 'reseauteur'

  return (
    <html lang="fr" className={hanken.variable} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://js.stripe.com" />
      </head>
      <body suppressHydrationWarning className="font-[family-name:var(--font-hanken)] overflow-x-hidden antialiased">
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
            <span className="hidden sm:inline text-xs font-medium border-l pl-2 ml-1">
              {SITE_TAGLINE}
            </span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-5" aria-label="Navigation principale">
            <Link
              href="/reseauteurs"
              className="ir-plasma-nav-link text-sm no-underline transition-colors hidden sm:inline font-medium"
            >
              Réseauteurs
            </Link>
            <Link
              href="/evenements"
              className="ir-plasma-nav-link text-sm no-underline transition-colors hidden sm:inline font-medium"
            >
              Événements
            </Link>
            <Link
              href="/reseaux"
              className="ir-plasma-nav-link text-sm no-underline transition-colors hidden sm:inline font-medium"
            >
              Réseaux
            </Link>
            <Link
              href="/partenaires"
              className="ir-plasma-nav-link text-sm no-underline transition-colors hidden sm:inline font-medium"
            >
              Partenaires
            </Link>
            <ThemeToggle />
            <div className="hidden sm:flex">
              {/* TODO accounts-and-billing : AuthNav doit afficher le rôle RÉSEAUTEURS (reseauteur/organisateur/admin) */}
              <AuthNav user={serializedUser} />
            </div>
            <MobileNavReseauteurs user={serializedUser} role={role} />
          </nav>
        </header>

        <Suspense>
          <RouteProgressBar />
        </Suspense>
        <Suspense>
          <ScrollToTop />
        </Suspense>

        <main>{children}</main>

        <FooterReseauteurs isAuthenticated={!!user} />
        <CookieInfoBanner />
        <Toaster
          position="bottom-right"
          toastOptions={{ style: { fontFamily: 'inherit' } }}
          richColors
          closeButton
        />
        <GoogleAnalytics />
      </body>
    </html>
  )
}
