'use client'

/**
 * BottomNavReseauteurs — barre de navigation basse (< lg / 1024px).
 *
 * Les 4 destinations publiques (réseauteurs, événements, réseaux, entreprises)
 * quittent le menu burger pour cette barre fixe : toujours visibles, à portée de
 * pouce, sans ouvrir de panneau. Le burger ne porte plus que l'espace membre.
 *
 * Hauteur exposée en CSS via `--ir-bottomnav-h` (styles.css) — les cartes plein
 * écran, le pied de page et les éléments flottants (bandeau cookies, bouton de
 * filtres) s'y réfèrent au lieu de dupliquer la valeur.
 *
 * Couleurs : variables de thème `--ir-*` — la barre suit la bascule clair ⇄ sombre.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PUBLIC_NAV_LINKS } from '@/lib/public-nav'

export default function BottomNavReseauteurs() {
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href || (pathname?.startsWith(href + '/') ?? false)

  return (
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-[880] border-t border-[rgba(var(--ir-line-rgb),0.08)] bg-[var(--ir-surface)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navigation principale"
    >
      <ul className="flex items-stretch">
        {PUBLIC_NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex h-14 flex-col items-center justify-center gap-1 no-underline transition-colors ${
                  active
                    ? 'text-[var(--ir-accent-text)]'
                    : 'text-[var(--ir-text-4)] hover:text-[var(--ir-text-2)]'
                }`}
              >
                {/* Repère d'onglet actif — la couleur seule ne suffit pas (a11y). */}
                {active && (
                  <span
                    aria-hidden
                    className="absolute top-0 h-0.5 w-8 rounded-full bg-[var(--ir-accent)]"
                  />
                )}
                <Icon size={21} aria-hidden />
                <span className="text-[11px] font-semibold leading-none">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
