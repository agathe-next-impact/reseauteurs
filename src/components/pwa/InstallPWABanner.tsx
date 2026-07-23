'use client'

/**
 * InstallPWABanner — invitation à installer l'app, mobile & tablette (< lg).
 *
 * Deux modes, car les navigateurs ne se ressemblent pas (détection et état dans
 * `lib/pwa-install`) :
 *   • **`prompt`** (Chrome/Edge, Android) — notre bouton déclenche le dialogue
 *     natif via `prompt()`. Suppose le service worker inerte de `public/sw.js`,
 *     sans lequel Chrome n'émet jamais `beforeinstallprompt`.
 *   • **`ios`** (Safari iOS/iPadOS) — Safari n'implémente PAS cette API : aucune
 *     installation ne peut être déclenchée par le site. La bannière n'est donc
 *     qu'une **consigne** : Partager → Sur l'écran d'accueil. C'est la seule voie
 *     possible, et personne ne la trouve sans y être invité.
 *
 * Discrétion — la bannière n'apparaît que si TOUT est vrai :
 *   1. pas déjà installé, pas de refus dans les 30 derniers jours (lib) ;
 *   2. au moins 2 pages vues dans la session (jamais au premier contact) ;
 *   3. le bandeau cookies est retombé (jamais deux bandeaux superposés) ;
 *   4. route non exclue (cartes plein écran, tunnels d'inscription, espace membre).
 */

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Download, Plus, Share, X } from 'lucide-react'
import { useConsent } from '@/lib/cookie-consent'
import { SITE_NAME } from '@/lib/site'
import {
  MIN_VUES,
  enregistrerVue,
  lancerInstall,
  refuserInstall,
  useEtatInstall,
} from '@/lib/pwa-install'

/** Routes où une bannière flottante nuirait : cartes plein écran, tunnels, dashboard. */
const ROUTES_EXCLUES = [
  '/carte',
  '/dashboard',
  '/inscription',
  '/login',
  '/reset-password',
  '/verify',
]

export default function InstallPWABanner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const consent = useConsent()
  const { mode, vues } = useEtatInstall()

  // Compteur d'engagement — une vue par changement de route dans la session.
  useEffect(() => {
    enregistrerVue()
  }, [pathname])

  const routeExclue =
    ROUTES_EXCLUES.some((p) => pathname === p || pathname?.startsWith(p + '/')) ||
    searchParams.get('vue') === 'carte'

  if (mode === null || routeExclue || vues < MIN_VUES || consent === 'pending') return null

  return (
    <div
      role="dialog"
      aria-labelledby="pwa-install-titre"
      /* z-820 : au-dessus du bouton flottant « Filtres » (800), sous le tiroir de
         filtres (900) et les slideovers (999/1000). Décalé au-dessus de la barre
         de navigation basse via --ir-bottomnav-h. */
      className="lg:hidden fixed bottom-[calc(1rem+var(--ir-bottomnav-h))] left-4 right-4 z-[820] bg-[var(--ir-surface)] border border-[rgba(var(--ir-line-rgb),0.14)] shadow-lg p-4"
    >
      <div className="flex items-start gap-3">
        <span
          className="shrink-0 w-10 h-10 flex items-center justify-center bg-[rgba(var(--ir-accent-rgb),0.10)] text-[var(--ir-accent-text)]"
          aria-hidden
        >
          <Download size={18} />
        </span>

        <div className="flex-1 min-w-0">
          <p id="pwa-install-titre" className="text-sm font-bold text-[var(--ir-text)]">
            Installer {SITE_NAME}
          </p>

          {mode === 'prompt' ? (
            <p className="text-sm text-[var(--ir-text-3)] leading-relaxed mt-1">
              Accès en un geste depuis votre écran d&apos;accueil, en plein écran.
            </p>
          ) : (
            // Safari : aucune API d'installation — on ne peut qu'expliquer le geste.
            <p className="text-sm text-[var(--ir-text-3)] leading-relaxed mt-1">
              Appuyez sur
              <Share size={14} className="inline-block align-text-bottom mx-1" aria-hidden />
              <span className="font-semibold">Partager</span>, puis
              <Plus size={14} className="inline-block align-text-bottom mx-1" aria-hidden />
              <span className="font-semibold">Sur l&apos;écran d&apos;accueil</span>.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={refuserInstall}
          aria-label="Ne plus proposer l'installation"
          className="shrink-0 -mt-1 -mr-1 p-2 text-[var(--ir-text-4)] hover:text-[var(--ir-text)] hover:bg-[var(--ir-surface-inset)] transition-colors cursor-pointer"
        >
          <X size={18} aria-hidden />
        </button>
      </div>

      {mode === 'prompt' && (
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={() => void lancerInstall()}
            className="flex-1 px-4 py-2.5 bg-[#035AA6] text-white text-sm font-bold hover:bg-[#02467F] transition-colors cursor-pointer"
          >
            Installer
          </button>
          <button
            type="button"
            onClick={refuserInstall}
            className="px-4 py-2.5 border border-[rgba(var(--ir-line-rgb),0.14)] text-sm font-semibold text-[var(--ir-text-3)] hover:bg-[var(--ir-surface-inset)] transition-colors cursor-pointer"
          >
            Plus tard
          </button>
        </div>
      )}
    </div>
  )
}
