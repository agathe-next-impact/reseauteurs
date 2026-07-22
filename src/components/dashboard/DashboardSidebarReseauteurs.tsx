'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Loader2, LogOut, LayoutDashboard, User, Network, CreditCard, Receipt, Settings, Building2, Calendar, CalendarCheck, CalendarDays } from 'lucide-react'

interface DashboardSidebarReseauteursProps {
  role: 'reseauteur' | 'organisateur' | 'partenaire' | 'admin'
  displayName: string
  /** ADR-0012 : vrai si l'utilisateur possède un réseau national (dérivé côté serveur, jamais côté client) */
  isNational?: boolean
}

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  roles: Array<'reseauteur' | 'organisateur' | 'partenaire' | 'admin'>
  /** Affiché uniquement si isNational est vrai (pour les organisateurs nationaux) */
  nationalOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Tableau de bord',
    icon: LayoutDashboard,
    roles: ['reseauteur', 'organisateur', 'partenaire', 'admin'],
  },
  {
    href: '/dashboard/profil',
    label: 'Mon profil',
    icon: User,
    roles: ['reseauteur'],
  },
  {
    href: '/dashboard/participations',
    label: 'Participations',
    icon: CalendarCheck,
    roles: ['reseauteur'],
  },
  {
    // Réseaux locaux possédés (ADR-0014) — la page gère le gate Plus
    href: '/dashboard/mes-reseaux',
    label: 'Mes réseaux',
    icon: Network,
    roles: ['reseauteur'],
  },
  {
    // Création/gestion d'événements (Réseauteur Plus) — la page gère le gate :
    // un réseauteur gratuit atterrit sur /dashboard/plus (présentation de l'offre).
    href: '/dashboard/mes-evenements',
    label: 'Mes événements',
    icon: CalendarDays,
    roles: ['reseauteur'],
  },
  {
    href: '/dashboard/partenaire',
    label: 'Ma fiche partenaire',
    icon: Building2,
    roles: ['partenaire'],
  },
  {
    href: '/dashboard/reseau',
    label: 'Mon réseau',
    icon: Building2,
    roles: ['organisateur'],
  },
  {
    href: '/dashboard/locaux',
    label: 'Mes groupes',
    icon: Network,
    roles: ['organisateur'],
    nationalOnly: true,
  },
  {
    href: '/dashboard/evenements',
    label: 'Événements',
    icon: Calendar,
    roles: ['organisateur'],
  },
  {
    // Hub de gestion d'abonnement — commun à tous les rôles souscripteurs (ADR-0016).
    href: '/dashboard/abonnement',
    label: 'Abonnement',
    icon: CreditCard,
    roles: ['reseauteur', 'organisateur', 'partenaire', 'admin'],
  },
  {
    href: '/dashboard/factures',
    label: 'Factures',
    icon: Receipt,
    roles: ['reseauteur', 'organisateur', 'partenaire'],
  },
  {
    href: '/dashboard/compte',
    label: 'Mon compte',
    icon: Settings,
    roles: ['reseauteur', 'organisateur', 'partenaire', 'admin'],
  },
]

const roleLabels: Record<DashboardSidebarReseauteursProps['role'], string> = {
  reseauteur: 'Réseauteur',
  organisateur: 'Organisateur',
  partenaire: 'Partenaire',
  admin: 'Administrateur',
}

export default function DashboardSidebarReseauteurs({ role, displayName, isNational = false }: DashboardSidebarReseauteursProps) {
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

  const visibleItems = NAV_ITEMS.filter(
    (item) =>
      item.roles.includes(role) &&
      (!item.nationalOnly || isNational),
  )

  return (
    <aside
      className="hidden md:flex flex-col w-[240px] shrink-0 bg-white border-r border-[#DFE0E1] h-[calc(100vh-64px)] sticky top-16"
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
        <p className="text-xs text-[#6E7175]">{roleLabels[role]}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2" aria-label="Menu dashboard">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname?.startsWith(item.href) ?? false
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
              {item.label}
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
          {isPending ? <Loader2 size={17} className="animate-spin" /> : <LogOut size={17} />}
          Déconnexion
        </button>
      </div>
    </aside>
  )
}
