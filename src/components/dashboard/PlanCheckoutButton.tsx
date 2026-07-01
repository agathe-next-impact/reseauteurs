'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui'
import PlanChangeConfirmModal from './PlanChangeConfirmModal'
import CheckoutInfiniteConfirmModal from './CheckoutInfiniteConfirmModal'

interface PlanCheckoutButtonProps {
  plan: 'premium' | 'infinite'
  label: string
  variant?: 'primary' | 'secondary'
  /**
   * `'checkout'` (défaut) : souscription initiale via Stripe Checkout, redirige
   * vers stripe.com pour le paiement. Utilise par gratuit → payant.
   *
   * `'change'` : change de plan sur la subscription existante. Ouvre une modale
   * de preview prorata avant confirmation ; sur confirm, POST
   * /api/stripe/change-plan via subscriptions.update. Pas de redirection.
   * Utilise par premium ⇄ infinite.
   */
  mode?: 'checkout' | 'change'
  /**
   * Indique si l'user peut potentiellement saisir un code de groupe lors de
   * la souscription/change-plan. False si deja membre d'un groupe ou role
   * organisateur. Determine si la modale Infinite affiche le champ code.
   * Sans effet pour Premium.
   */
  canUseGroupeCode?: boolean
}

const PLAN_LABELS: Record<'premium' | 'infinite', string> = {
  premium: 'Premium',
  infinite: 'Infinite',
}

export default function PlanCheckoutButton({
  plan,
  label,
  variant = 'primary',
  mode = 'checkout',
  canUseGroupeCode = false,
}: PlanCheckoutButtonProps) {
  const [loading, setLoading] = useState(false)
  const [changeModalOpen, setChangeModalOpen] = useState(false)
  const [checkoutInfiniteModalOpen, setCheckoutInfiniteModalOpen] = useState(false)

  // Pour gratuit → infinite, on ouvre une modale de confirmation qui propose
  // un champ code de groupe optionnel avant la redirection Stripe. La modale
  // n'a d'interet que si l'user PEUT effectivement saisir un code (pas
  // organisateur, pas deja en groupe) ; sinon redirection directe legacy.
  const useInfiniteCheckoutModal = mode === 'checkout' && plan === 'infinite' && canUseGroupeCode

  async function handleClick() {
    if (mode === 'change') {
      setChangeModalOpen(true)
      return
    }

    if (useInfiniteCheckoutModal) {
      setCheckoutInfiniteModalOpen(true)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        toast.error(data.error || 'Erreur lors de la création de la session Stripe.')
        setLoading(false)
        return
      }
      window.location.href = data.url
    } catch {
      toast.error('Erreur lors de la redirection vers Stripe.')
      setLoading(false)
    }
  }

  return (
    <>
      <Button variant={variant} loading={loading} disabled={loading} onClick={handleClick} className="w-full">
        {label}
      </Button>
      {mode === 'change' && (
        <PlanChangeConfirmModal
          open={changeModalOpen}
          onOpenChange={setChangeModalOpen}
          plan={plan}
          planLabel={PLAN_LABELS[plan]}
          canUseGroupeCode={canUseGroupeCode}
        />
      )}
      {useInfiniteCheckoutModal && (
        <CheckoutInfiniteConfirmModal
          open={checkoutInfiniteModalOpen}
          onOpenChange={setCheckoutInfiniteModalOpen}
          canUseGroupeCode={canUseGroupeCode}
        />
      )}
    </>
  )
}
