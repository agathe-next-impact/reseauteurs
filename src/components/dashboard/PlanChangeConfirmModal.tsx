'use client'

import { useEffect, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { X, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui'
import GroupePromoCodeInput, { type GroupePromoCodeChange } from './GroupePromoCodeInput'

interface PreviewData {
  direction: 'upgrade' | 'downgrade'
  amountDueCents: number
  creditCents: number
  nextRenewalDateISO: string
  nextRenewalAmountCents: number
  currency: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: 'premium' | 'infinite'
  planLabel: string
  /**
   * Indique si l'user peut saisir un code de groupe lors d'un upgrade vers
   * Infinite. False si deja membre d'un groupe ou organisateur. Sans effet
   * pour le downgrade vers Premium.
   */
  canUseGroupeCode?: boolean
}

function formatEuro(cents: number): string {
  return (cents / 100)
    .toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .replace(',00', '')
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

/**
 * Poll /api/users/refresh-token jusqu'à ce que le JWT régénéré contienne
 * le plan cible, ou jusqu'au timeout. refresh-token relit le user depuis la
 * DB (contrairement a /api/users/me qui renvoie les champs saveToJWT du
 * cookie courant — stale). Intervalle croissant pour coller au lag webhook
 * Stripe (typiquement 1-3s).
 */
async function pollUntilPlanApplied(
  expected: 'premium' | 'infinite',
  timeoutMs: number,
): Promise<boolean> {
  const start = Date.now()
  let delay = 400
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch('/api/users/refresh-token', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      })
      if (res.ok) {
        const data = (await res.json()) as { user?: { plan?: string } }
        if (data.user?.plan === expected) return true
      }
    } catch {
      // ignore et retente
    }
    await new Promise((r) => setTimeout(r, delay))
    delay = Math.min(delay + 300, 1500)
  }
  return false
}

export default function PlanChangeConfirmModal({ open, onOpenChange, plan, planLabel, canUseGroupeCode = false }: Props) {
  const router = useRouter()
  const [previewLoading, setPreviewLoading] = useState(false)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [codeState, setCodeState] = useState<GroupePromoCodeChange>({
    rawCode: '',
    validatedGroupeCode: null,
    validatedPromotionCode: null,
    reductionPct: 0,
  })

  // Le champ code n'est rendu que pour un upgrade vers Infinite et seulement
  // si le parent autorise (canUseGroupeCode = !groupeId && role !== organisateur).
  // On verifie aussi `direction === 'upgrade'` pour ne pas afficher le champ
  // dans une modale ouverte par un chemin atypique (downgrade reste premium).
  const showGroupeCodeField =
    canUseGroupeCode && plan === 'infinite' && preview?.direction === 'upgrade'

  // Sync des states d'UI sur les transitions de `open` via
  // adjust-state-while-rendering (react.dev). L'ouverture reset l'erreur/
  // preview et déclenché le loading ; la fermeture vide tous les states.
  // Remplace un useEffect([open]) qui appelait setState synchroniquement —
  // flagge par le React Compiler comme cascading render.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setPreview(null)
      setPreviewError(null)
      setPreviewLoading(true)
      setCodeState({
        rawCode: '',
        validatedGroupeCode: null,
        validatedPromotionCode: null,
        reductionPct: 0,
      })
    } else {
      setPreview(null)
      setPreviewError(null)
      setSubmitting(false)
      setPreviewLoading(false)
      setCodeState({
        rawCode: '',
        validatedGroupeCode: null,
        validatedPromotionCode: null,
        reductionPct: 0,
      })
    }
  }

  // Fetch du preview quand la modal est ouverte OU quand le code valide change.
  // Si l'user saisit un code valide, le preview est rejoue avec ce code pour
  // que la proration affichee reflete la remise. Le debounce de l'input
  // (500ms) limite deja la frequence des hits API.
  const validatedCode = codeState.validatedGroupeCode
  useEffect(() => {
    if (!open) return

    let cancelled = false
    setPreviewLoading(true)
    fetch('/api/stripe/preview-change-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan,
        ...(validatedCode ? { groupeCode: validatedCode } : {}),
      }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setPreviewError(data.error || 'Erreur lors du calcul du prorata.')
          setPreviewLoading(false)
          return
        }
        setPreview(data as PreviewData)
        setPreviewError(null)
        setPreviewLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setPreviewError('Impossible de contacter Stripe pour le moment.')
        setPreviewLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, plan, validatedCode])

  async function handleConfirm() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/stripe/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          ...(validatedCode ? { groupeCode: validatedCode } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur lors du changement de plan.')
        setSubmitting(false)
        return
      }

      // B3 — Stripe a accepté le change, mais la DB n'est mise a jour que par
      // le webhook customer.subscription.updated (lag typique 1-3s). On poll
      // /api/users/refresh-token jusqu'à ce que le JWT régénéré contienne le
      // nouveau plan (la route Payload relit la DB à chaque appel). Le dernier
      // appel reussi met a jour le cookie, donc le prochain render RSC verra
      // le bon plan.
      const planSynced = await pollUntilPlanApplied(plan, 10_000)

      if (planSynced) {
        toast.success(
          preview?.direction === 'upgrade'
            ? `Plan passe a ${planLabel}. La facture de prorata est disponible dans votre historique.`
            : `Plan passe a ${planLabel}. Le crédit sera appliqué sur votre prochaine facture.`,
        )
      } else {
        // Webhook en retard (>10s). Le paiement Stripe est bien pris en compte
        // mais la DB n'a pas encore bascule. On informé l'utilisateur sans
        // bloquer — un rechargement manuel ou le prochain render aura l'état a jour.
        toast.success(
          `Changement de plan enregistré chez Stripe. La mise a jour de votre espace peut prendre quelques instants — rechargez la page si besoin.`,
        )
      }

      onOpenChange(false)
      router.refresh()
    } catch {
      toast.error('Erreur reseau lors du changement de plan.')
      setSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white border border-[#e4e4e7] outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          <div className="flex items-start justify-between border-b border-border p-5">
            <Dialog.Title className="text-lg font-semibold text-text-dark">
              Passer a {planLabel}
            </Dialog.Title>
            <Dialog.Close className="text-text-light hover:text-text-dark rounded p-1">
              <X size={18} />
            </Dialog.Close>
          </div>

          <Dialog.Description className="sr-only">
            Recapitulatif du changement de plan avec montant a payer ou crédit appliqué.
          </Dialog.Description>

          <div className="p-5 space-y-4">
            {previewLoading && (
              <div className="flex items-center justify-center py-6 text-text-light">
                <Loader2 size={18} className="animate-spin mr-2" />
                Calcul du prorata en cours...
              </div>
            )}

            {previewError && !previewLoading && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{previewError}</p>
              </div>
            )}

            {preview && !previewLoading && !previewError && (
              <>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-text-light">
                  Recapitulatif de votre changement
                </h3>

                {preview.direction === 'upgrade' ? (
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-text-dark">
                      {formatEuro(preview.amountDueCents)} {preview.currency}
                    </p>
                    <p className="text-sm text-text-medium">
                      A payer aujourd&apos;hui (prorata sur la période restante).
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-text-dark">0 {preview.currency}</p>
                    <p className="text-sm text-text-medium">
                      A payer aujourd&apos;hui.
                    </p>
                    {preview.creditCents > 0 && (
                      <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1.5 mt-2 inline-block">
                        Crédit de {formatEuro(preview.creditCents)} {preview.currency} appliqué
                        sur votre prochaine facture.
                      </p>
                    )}
                  </div>
                )}

                <div className="pt-3 border-t border-border-light">
                  <p className="text-sm text-text-light">Prochain renouvellement</p>
                  <p className="text-sm text-text-dark">
                    {formatEuro(preview.nextRenewalAmountCents)} {preview.currency} le{' '}
                    {formatDate(preview.nextRenewalDateISO)}
                  </p>
                </div>
              </>
            )}

            {showGroupeCodeField && (
              <div className="pt-3 border-t border-border-light">
                <GroupePromoCodeInput
                  onChange={setCodeState}
                  disabled={submitting}
                  allowStripePromo={false}
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
              disabled={
                submitting ||
                previewLoading ||
                !!previewError ||
                !preview ||
                // Bloque la confirmation si un code a ete saisi mais n'a pas
                // (encore) ete valide cote serveur — evite d'envoyer un code
                // rejete dans le body.
                (codeState.rawCode.length > 0 && codeState.validatedGroupeCode === null)
              }
              onClick={handleConfirm}
            >
              {preview?.direction === 'upgrade' ? 'Confirmer et payer' : 'Confirmer'}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
