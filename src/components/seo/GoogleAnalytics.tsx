'use client'

import Script from 'next/script'
import { useConsent } from '@/lib/cookie-consent'

const GA_MEASUREMENT_ID = 'G-885GFZ4J4Q'

// Charge gtag.js uniquement apres consentement explicite de l'utilisateur
// (cf. CookieInfoBanner). Si consent === 'denied' ou 'pending', rien n'est
// charge et aucun beacon n'est envoye vers google-analytics.com.
// Reactif : si l'utilisateur clique Accepter apres mount, GA se charge.
export default function GoogleAnalytics() {
  const consent = useConsent()

  if (consent !== 'granted') return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  )
}
