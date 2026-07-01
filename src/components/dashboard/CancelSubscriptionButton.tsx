'use client'

import { useState } from 'react'
import { Button } from '@/components/ui'
import CancelConfirmModal from './CancelConfirmModal'

interface Props {
  /**
   * `'link'` (défaut) : lien rouge souligne discret, utilise dans la section
   * « Gestion de l'abonnement » ou a cote d'autres elements inline.
   *
   * `'card'` : bouton secondary pleine largeur, utilise dans la carte plan
   * gratuit quand l'utilisateur est actuellement Premium/Infinite (downgrade).
   */
  variant?: 'link' | 'card'
}

export default function CancelSubscriptionButton({ variant = 'link' }: Props) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      {variant === 'card' ? (
        <Button
          variant="secondary"
          onClick={() => setModalOpen(true)}
          className="w-full"
        >
          Revenir au plan gratuit
        </Button>
      ) : (
        <button
          onClick={() => setModalOpen(true)}
          className="text-sm text-red-600 hover:text-red-700 underline underline-offset-2"
        >
          Annuler mon abonnement
        </button>
      )}
      <CancelConfirmModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  )
}
