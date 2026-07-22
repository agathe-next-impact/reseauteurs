'use client'

/**
 * MobileNavReseauteurs — navigation mobile & tablette (< lg / 1024px).
 *
 * Le menu ouvert est un **panneau plein écran** (et non un tiroir latéral) :
 * cibles tactiles larges, typographie généreuse, lecture immédiate.
 *
 * Couleurs : variables de thème `--ir-*` (et non des hex figés) — le menu
 * couvrant tout l'écran, il doit suivre la bascule clair ⇄ sombre du site.
 */

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Menu, X, Users, Calendar, Network, Handshake, LayoutDashboard, Loader2 } from 'lucide-react'
import { useAuth } from './AuthProvider'
import ThemeToggle from './ThemeToggle'
import { SITE_NAME } from '@/lib/site'

const NAV_LINKS = [
  { href: '/reseauteurs', label: 'Réseauteurs', icon: Users },
  { href: '/evenements', label: 'Événements', icon: Calendar },
  { href: '/reseaux', label: 'Réseaux', icon: Network },
  { href: '/partenaires', label: 'Entreprises', icon: Handshake },
]

/** Bordure douce commune (même valeur que l'en-tête du site). */
const LINE = 'border-[rgba(var(--ir-line-rgb),0.08)]'

export default function MobileNavReseauteurs() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const pathname = usePathname()
  const close = useCallback(() => setOpen(false), [])

  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    if (open) setOpen(false)
  }

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  async function handleLogout() {
    setIsPending(true)
    try {
      await fetch('/api/users/logout', { method: 'POST' })
    } catch { /* ignore */ }
    window.location.assign('/')
  }

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/')

  return (
    <>
      {/* Déclencheur — reste dans l'en-tête du site */}
      <div className="lg:hidden flex items-center gap-1 -mr-1">
        {user ? (
          <Link
            href="/dashboard"
            className="p-2.5 rounded-lg text-[#4E5155] hover:text-[#035AA6] hover:bg-[#A9C9E4]/30 transition-colors"
            aria-label="Mon espace"
          >
            <LayoutDashboard size={20} />
          </Link>
        ) : (
          <Link
            href="/inscription"
            className="p-2.5 rounded-full bg-[#035AA6] text-white text-sm font-semibold hover:bg-[#02467F] transition-colors no-underline"
          >
            S&apos;inscrire
          </Link>
        )}
        <button
          className="p-2.5 rounded-lg text-[#4E5155] hover:text-[#1D1E21] hover:bg-[#E9E9EA] transition-colors cursor-pointer"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le menu"
          aria-expanded={open}
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Menu PLEIN ÉCRAN (mobile + tablette).
          Rendu via un PORTAIL sur <body> : l'en-tête applique un `backdrop-filter`,
          ce qui en ferait le bloc conteneur des descendants `position: fixed` —
          `inset-0` se résoudrait alors sur l'en-tête (~64px) au lieu de la fenêtre. */}
      {open && createPortal(
        <div
          className={`lg:hidden fixed inset-0 z-[9990] flex flex-col bg-[var(--ir-surface)] animate-[slideLeft_220ms_cubic-bezier(0.4,0,0.2,1)]`}
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navigation"
        >
          {/* Barre supérieure — même hauteur et mêmes gouttières que l'en-tête */}
          <div className={`min-h-16 flex items-center justify-between px-4 sm:px-6 border-b ${LINE}`}>
            <Link
              href="/"
              onClick={close}
              className="inline-flex items-center gap-2 no-underline py-2"
              aria-label={`Accueil ${SITE_NAME}`}
            >
              <Image src="/img/logo.png" alt="" width={36} height={36} className="h-8 w-8 flex-none" aria-hidden />
              <span className="text-lg font-extrabold tracking-tight text-[var(--ir-text)]">
                {SITE_NAME.toUpperCase()}
              </span>
            </Link>
            <div className="flex items-center gap-1 -mr-1">
              {/* L'en-tête étant masqué, la bascule de thème reste accessible ici. */}
              <ThemeToggle />
              <button
                onClick={close}
                aria-label="Fermer le menu"
                className="p-2.5 rounded-lg text-[var(--ir-text-3)] hover:text-[var(--ir-text)] hover:bg-[var(--ir-surface-inset)] transition-colors cursor-pointer"
              >
                <X size={22} />
              </button>
            </div>
          </div>

          {/* Liens principaux — cibles larges, typo généreuse */}
          <nav className="flex-1 overflow-y-auto px-4 sm:px-6 py-4" aria-label="Navigation principale">
            <ul className="flex flex-col gap-1">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => {
                const active = isActive(href)
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-4 rounded-xl px-4 py-4 text-lg font-semibold no-underline transition-colors ${
                        active
                          ? 'bg-[rgba(var(--ir-accent-rgb),0.10)] text-[var(--ir-accent-text)]'
                          : 'text-[var(--ir-text-2)] hover:bg-[var(--ir-surface-inset)]'
                      }`}
                    >
                      <Icon
                        size={22}
                        aria-hidden
                        className={active ? '' : 'text-[var(--ir-text-4)]'}
                      />
                      {label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Compte — pied de menu (marge sûre iOS) */}
          <div
            className={`border-t ${LINE} px-4 sm:px-6 py-4`}
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            {user ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <Link
                  href="/dashboard"
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-[rgba(var(--ir-line-rgb),0.12)] px-4 py-3 text-sm font-semibold text-[var(--ir-text-2)] no-underline hover:bg-[var(--ir-surface-inset)] transition-colors"
                >
                  Mon espace
                </Link>
                <button
                  onClick={handleLogout}
                  disabled={isPending}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-[var(--ir-text-4)] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isPending ? <Loader2 size={18} className="animate-spin" /> : null}
                  Déconnexion
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <Link
                  href="/login"
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-[rgba(var(--ir-line-rgb),0.12)] px-4 py-3 text-sm font-semibold text-[var(--ir-text-2)] no-underline hover:bg-[var(--ir-surface-inset)] transition-colors"
                >
                  Connexion
                </Link>
                <Link
                  href="/inscription"
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#035AA6] px-4 py-3 text-sm font-semibold text-white no-underline hover:bg-[#02467F] transition-colors"
                >
                  Créer mon profil — gratuit
                </Link>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
