import {
  LayoutDashboard,
  Building2,
  Calendar,
  Globe,
  Images,
  CreditCard,
  UserCog,
  Users,
} from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
  /** Visible only when the user has a paid plan (premium or infinite) */
  paidOnly?: boolean
  /** Visible only when the user has the infinite plan */
  infiniteOnly?: boolean
  /** Restrict to specific roles (if set, only shown for these roles) */
  roles?: Array<'fournisseur' | 'organisateur' | 'admin'>
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/dashboard/fiche', label: 'Ma fiche', icon: Building2, roles: ['fournisseur', 'admin'] },
  { href: '/dashboard/fiche-organisateur', label: 'Ma fiche organisateur', icon: Building2, roles: ['organisateur'] },
  { href: '/dashboard/photos', label: 'Mes photos', icon: Images, roles: ['fournisseur', 'admin'] },
  { href: '/dashboard/evenements', label: 'Mes événements', icon: Calendar, roles: ['fournisseur', 'admin'] },
  { href: '/dashboard/evenements-nationaux', label: 'Événements nationaux', icon: Globe, infiniteOnly: true, roles: ['fournisseur', 'admin'] },
  { href: '/dashboard/evenements', label: 'Mes événements', icon: Calendar, roles: ['organisateur'] },
  { href: '/dashboard/groupe', label: 'Mon groupe', icon: Users, roles: ['fournisseur', 'admin'] },
  { href: '/dashboard/abonnement', label: 'Abonnement', icon: CreditCard },
  { href: '/dashboard/compte', label: 'Mon compte', icon: UserCog },
]

export function filterNavItems(
  items: NavItem[],
  plan: 'gratuit' | 'premium' | 'infinite',
  role: 'fournisseur' | 'organisateur' | 'admin',
  options?: { hasGroupe?: boolean },
): NavItem[] {
  const isPaid = plan === 'premium' || plan === 'infinite'
  const isInfinite = plan === 'infinite'
  const hasGroupe = options?.hasGroupe ?? false
  return items.filter((item) => {
    if (item.roles && !item.roles.includes(role)) return false
    // Un user downgrade mais toujours membre d'un groupe doit garder l'acces
    // au hub /dashboard/groupe pour pouvoir en sortir.
    if (item.href === '/dashboard/groupe' && hasGroupe) return true
    if (item.infiniteOnly && !isInfinite) return false
    if (item.paidOnly && !isPaid) return false
    return true
  })
}
