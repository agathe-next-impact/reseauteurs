'use client'

import Link from 'next/link'
import { Cookie } from 'lucide-react'
import { useConsent, setConsent } from '@/lib/cookie-consent'

export default function CookieInfoBanner() {
  const consent = useConsent()

  // Banner affiche uniquement tant que l'utilisateur n'a ni accepte ni refuse.
  if (consent !== 'pending') return null

  return (
    <div
      role="dialog"
      aria-label="Information cookies"
      className="fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-sm z-40 bg-white border border-gray-200 rounded-xl shadow-lg p-4"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-8 h-8 rounded-full bg-primary-light flex items-center justify-center">
          <Cookie size={16} className="text-primary" aria-hidden="true" />
        </div>
        <div className="flex-1 text-sm text-text-medium leading-relaxed">
          <p className="font-semibold text-text-dark text-sm mb-1">
            Cookies & mesure d&apos;audience
          </p>
          <p>
            RÉSEAUTEURS utilise des cookies techniques (session, sécurité, cartes) et,
            avec votre accord, Google Analytics pour mesurer la fréquentation de manière agrégée.
            {' '}
            <Link href="/cookies" className="text-primary hover:underline">
              En savoir plus
            </Link>
            .
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => setConsent('denied')}
          className="px-4 py-1.5 bg-white border border-gray-300 text-text-medium rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer"
        >
          Refuser
        </button>
        <button
          type="button"
          onClick={() => setConsent('granted')}
          className="px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors cursor-pointer"
        >
          Accepter
        </button>
      </div>
    </div>
  )
}
