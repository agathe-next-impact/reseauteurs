'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/Skeleton'
import type { Evenement } from '@/payload-types'
import type { CategoryOption } from '@/lib/categories'

interface FournisseurOption {
  id: number
  raisonSociale: string
  ville: string
}

interface EvenementsManagerLoaderProps {
  fournisseurId: number
  fournisseurs: FournisseurOption[]
  initialEvenements: Evenement[]
  typesEvenement: CategoryOption[]
  categoriesActivite: CategoryOption[]
  isOrganisateur?: boolean
  organisateurExterneId?: number
}

const EvenementsManager = dynamic(() => import('./EvenementsManager'), {
  ssr: false,
  loading: () => <Skeleton variant="card" />,
})

export default function EvenementsManagerLoader(props: EvenementsManagerLoaderProps) {
  return <EvenementsManager {...props} />
}
