'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Loader2, Lock } from 'lucide-react'
import {
  DASHBOARD_ROLE_LABELS,
  isDashboardNavActive,
  visibleDashboardNav,
  type DashboardRole,
} from '@/lib/dashboard-nav'

interface DashboardSidebarReseauteursProps {
  role: DashboardRole
  displayName: string
  /** ADR-0012 : vrai si l'utilisateur possède un réseau national (dérivé côté serveur, jamais côté client) */
  isNational?: boolean
  /** Réseauteur Plus actif (dérivé serveur) : sans lui, les items `plusGated` portent un badge « Plus ». */
  plusActif?: boolean
}

export default function DashboardSidebarReseauteurs({ role, displayName, isNational = false, plusActif = false }: DashboardSidebarReseauteursProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  async function handleLogout() {
    await fetch('/api/users/logout', { method: 'POST' })
    startTransition(() => {
      router.push('/')
      router.refresh()
    })
  }

  const visibleItems = visibleDashboardNav(role, isNational)

  return (
    <aside
      // Entre md et lg la barre de navigation basse est encore affichée : sans
      // retrancher sa hauteur, elle recouvrirait le bouton de déconnexion.
      className="hidden md:flex flex-col w-[240px] shrink-0 bg-white border-r border-[#DFE0E1] h-[calc(100vh-64px-var(--ir-bottomnav-h))] sticky top-16"
      aria-label="Navigation tableau de bord"
    >
      {/* Brand */}
      <Link
        href="/"
        className="flex items-center gap-2 px-4 py-3 border-b border-[#DFE0E1] no-underline"
        aria-label="Accueil RÉSEAUTEURS"
      >
        <span className="text-sm font-extrabold tracking-tight text-[#012A4A]">RÉSEAUTEURS</span>
      </Link>

      {/* Utilisateur */}
      <div className="px-4 py-4 border-b border-[#DFE0E1]">
        <div className="w-9 h-9 rounded-full bg-[#A9C9E4]/40 flex items-center justify-center text-[#035AA6] font-bold text-sm mb-2">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <p className="text-sm font-medium text-[#1D1E21] truncate">{displayName}</p>
        <p className="text-xs text-[#6E7175]">{DASHBOARD_ROLE_LABELS[role]}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2" aria-label="Menu dashboard">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const isActive = isDashboardNavActive(item.href, pathname)
          // Fonctionnalité Plus non débloquée : on signale le verrou dès la nav,
          // pour que l'utilisateur sache avant de cliquer que la section est payante.
          const verrouille = Boolean(item.plusGated) && !plusActif
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors no-underline ${
                isActive
                  ? 'bg-[#A9C9E4]/30 text-[#035AA6] border-r-2 border-[#035AA6]'
                  : 'text-[#4E5155] hover:bg-[#E9E9EA] hover:text-[#1D1E21]'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={17} aria-hidden />
              <span className="flex-1">{item.label}</span>
              {verrouille && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-[#F5E050] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#012A4A]"
                  title="Réservé à Réseauteur Plus"
                >
                  <Lock size={9} aria-hidden />
                  Plus
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Déconnexion */}
      <div className="border-t border-[#DFE0E1] p-3">
        <button
          onClick={handleLogout}
          disabled={isPending}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-[#6E7175] hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
        >
          {isPending ? <Loader2 size={17} className="animate-spin" /> : null}
          Déconnexion
        </button>
      </div>
    </aside>
  )
}
