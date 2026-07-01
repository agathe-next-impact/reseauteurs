'use client'

import { useState } from 'react'
import { Button } from '@/components/ui'
import ReactivateConfirmModal from './ReactivateConfirmModal'

interface Props {
  /**
   * `'inline'` (défaut) : bouton vert compact, utilise dans l'alerte ambre
   * de la section « Gestion de l'abonnement ».
   *
   * `'card'` : bouton secondary pleine largeur pour s'aligner sur les autres
   * CTA de `PlanCheckoutButton` dans la grille de plans.
   */
  variant?: 'inline' | 'card'
  label?: string
}

export default function ReactivateButton({ variant = 'inline', label }: Props) {
  const [modalOpen, setModalOpen] = useState(false)

  const defaultLabel = variant === 'card' ? 'Reactiver mon abonnement' : 'Reactiver le renouvellement auto'

  return (
    <>
      {variant === 'card' ? (
        <Button
          variant="primary"
          onClick={() => setModalOpen(true)}
          className="w-full"
        >
          {label ?? defaultLabel}
        </Button>
      ) : (
        <button
          onClick={() => setModalOpen(true)}
          className="shrink-0 text-sm font-medium px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          {label ?? defaultLabel}
        </button>
      )}
      <ReactivateConfirmModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  )
}
