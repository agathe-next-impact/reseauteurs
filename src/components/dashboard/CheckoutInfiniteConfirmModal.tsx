'use client'

import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui'
import GroupePromoCodeInput, { type GroupePromoCodeChange } from './GroupePromoCodeInput'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Indique si l'user peut potentiellement utiliser un code de groupe :
   *   - false si deja membre d'un groupe (le palier s'applique automatiquement)
   *   - false si role organisateur (mutualisation reservee aux fournisseurs)
   *   - true sinon → on rend le champ optionnel
   */
  canUseGroupeCode: boolean
}

/**
 * Modale d'introduction au checkout Stripe pour la souscription Infinite
 * (gratuit → infinite). Permet a l'user de saisir un code d'affiliation
 * optionnel avant de partir vers stripe.com — le coupon de groupe sera
 * applique des la 1ere facture, et le user sera attache au groupe par le
 * webhook checkout.session.completed via pendingGroupeCode.
 *
 * Pour les users deja dans un groupe ou les organisateurs, la modale n'est
 * pas ouverte (PlanCheckoutButton redirige directement vers Stripe).
 */
export default function CheckoutInfiniteConfirmModal({
  open,
  onOpenChange,
  canUseGroupeCode,
}: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [codeState, setCodeState] = useState<GroupePromoCodeChange>({
    rawCode: '',
    validatedGroupeCode: null,
    validatedPromotionCode: null,
    reductionPct: 0,
  })

  // Reset code state lorsque la modale se ferme — la prochaine ouverture doit
  // partir d'un champ vide pour eviter qu'un code obsolete persiste.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (!open) {
      setCodeState({
        rawCode: '',
        validatedGroupeCode: null,
        validatedPromotionCode: null,
        reductionPct: 0,
      })
      setSubmitting(false)
    }
  }

  async function handleConfirm() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: 'infinite',
          ...(codeState.validatedGroupeCode ? { groupeCode: codeState.validatedGroupeCode } : {}),
          ...(codeState.validatedPromotionCode
            ? { promotionCode: codeState.validatedPromotionCode }
            : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        toast.error(data.error || 'Erreur lors de la creation de la session Stripe.')
        setSubmitting(false)
        return
      }
      window.location.href = data.url
    } catch {
      toast.error('Erreur lors de la redirection vers Stripe.')
      setSubmitting(false)
    }
  }

  // Si un code est saisi mais pas encore valide, on bloque la soumission
  // pour eviter d'envoyer un code rejete (ce qui couterait un round-trip
  // 404 + perte de la valeur saisie). Code vide = soumission OK sans code.
  const hasInvalidCode =
    codeState.rawCode.length > 0 &&
    codeState.validatedGroupeCode === null &&
    codeState.validatedPromotionCode === null

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white shadow-xl outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          <div className="flex items-start justify-between border-b border-border p-5">
            <Dialog.Title className="text-lg font-semibold text-text-dark">
              Souscrire a Infinite
            </Dialog.Title>
            <Dialog.Close className="text-text-light hover:text-text-dark rounded p-1">
              <X size={18} />
            </Dialog.Close>
          </div>

          <Dialog.Description className="sr-only">
            Confirmez votre souscription au plan Infinite et saisissez optionnellement
            un code d&apos;affiliation de groupe.
          </Dialog.Description>

          <div className="p-5 space-y-4">
            <p className="text-sm text-text-medium">
              Vous allez etre redirige vers Stripe pour finaliser le paiement de
              votre abonnement Infinite (219 EUR HT/an).
            </p>

            {canUseGroupeCode && (
              <div className="pt-3 border-t border-border-light">
                <GroupePromoCodeInput
                  onChange={setCodeState}
                  disabled={submitting}
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border p-5">
            <Dialog.Close
              disabled={submitting}
              className="text-sm font-medium px-4 py-2 text-text-medium hover:text-text-dark"
            >
              Annuler
            </Dialog.Close>
            <Button
              variant="primary"
              loading={submitting}
              disabled={submitting || hasInvalidCode}
              onClick={handleConfirm}
            >
              Aller au paiement
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
