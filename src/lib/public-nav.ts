/**
 * Navigation publique — les 4 destinations principales du site.
 *
 * Source unique partagée par la barre d'en-tête (≥ lg, liens texte) et la barre de
 * navigation basse (< lg, `BottomNavReseauteurs`, icône + libellé). Sous `lg`, ces
 * liens ne sont plus dans le menu burger : ils sont toujours visibles en bas d'écran.
 */
import type { ElementType } from 'react'
import { Users, Calendar, Network, Handshake } from 'lucide-react'

export type PublicNavLink = {
  href: string
  label: string
  icon: ElementType
}

export const PUBLIC_NAV_LINKS: PublicNavLink[] = [
  { href: '/reseauteurs', label: 'Réseauteurs', icon: Users },
  { href: '/evenements', label: 'Événements', icon: Calendar },
  { href: '/reseaux', label: 'Réseaux', icon: Network },
  { href: '/partenaires', label: 'Entreprises', icon: Handshake },
]
