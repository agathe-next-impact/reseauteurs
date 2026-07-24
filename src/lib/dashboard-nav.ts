/**
 * Navigation de l'espace membre — source de vérité UNIQUE.
 *
 * Partagée par la barre latérale desktop (`DashboardSidebarReseauteurs`, ≥ md) et le
 * menu plein écran mobile/tablette (`MobileNavReseauteurs`, < lg) : la sidebar étant
 * masquée sous `md`, un membre connecté sur mobile n'avait AUCUN accès à son espace
 * depuis le menu. Les deux surfaces lisent désormais la même liste.
 *
 * ⚠️ Ces entrées ne sont qu'un affichage : l'autorisation réelle (rôle, propriété,
 * gate Plus) reste posée côté serveur par chaque page (§11 CLAUDE.md).
 */
import type { ElementType } from 'react'
import {
  LayoutDashboard,
  User,
  Network,
  CreditCard,
  Receipt,
  Settings,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarDays,
} from 'lucide-react'

export type DashboardRole = 'reseauteur' | 'organisateur' | 'partenaire' | 'admin'

export type DashboardNavItem = {
  href: string
  label: string
  icon: ElementType
  roles: DashboardRole[]
  /** Affiché uniquement si isNational est vrai (organisateurs d'une tête de réseau) */
  nationalOnly?: boolean
  /** Fonctionnalité réservée à Réseauteur Plus : la nav affiche un badge « Plus »
   *  tant que le compte est gratuit (le gate réel reste serveur — ADR-0014/0015). */
  plusGated?: boolean
}

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
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
    // Route inchangée (/dashboard/participations) — seul le libellé affiché change.
    href: '/dashboard/participations',
    label: 'Mes adhésions',
    icon: CalendarCheck,
    roles: ['reseauteur'],
  },
  {
    // Réseaux locaux possédés (ADR-0014) — réservé à Réseauteur Plus.
    href: '/dashboard/mes-reseaux',
    label: 'Mes réseaux',
    icon: Network,
    roles: ['reseauteur'],
    plusGated: true,
  },
  {
    // Création/gestion d'événements — réservé à Réseauteur Plus (un compte gratuit
    // voit l'offre commerciale sur la page cible au lieu d'un accès direct).
    href: '/dashboard/mes-evenements',
    label: 'Mes événements',
    icon: CalendarDays,
    roles: ['reseauteur'],
    plusGated: true,
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

export const DASHBOARD_ROLE_LABELS: Record<DashboardRole, string> = {
  reseauteur: 'Réseauteur',
  organisateur: 'Organisateur',
  partenaire: 'Partenaire',
  admin: 'Administrateur',
}

/** Entrées visibles pour un rôle donné (+ réservé aux têtes de réseau). */
export function visibleDashboardNav(role: DashboardRole, isNational = false): DashboardNavItem[] {
  return DASHBOARD_NAV_ITEMS.filter(
    (item) => item.roles.includes(role) && (!item.nationalOnly || isNational),
  )
}

/** `/dashboard` est actif en correspondance exacte, les autres par préfixe. */
export function isDashboardNavActive(href: string, pathname: string | null): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname?.startsWith(href) ?? false
}
