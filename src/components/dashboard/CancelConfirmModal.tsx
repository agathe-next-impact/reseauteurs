'use client'

import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { X, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Libellé de l'abonnement concerné (ex. « Réseauteur Plus »). */
  productLabel?: string
  /** Date de fin d'accès affichée (déjà formatée, ex. « 16 juillet 2027 »). */
  endDateLabel?: string | null
}

export default function CancelConfirmModal({
  open,
  onOpenChange,
  productLabel,
  endDateLabel,
}: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/stripe/cancel', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de l\'annulation.')
        setSubmitting(false)
        return
      }
      toast.success('Abonnement annulé. Vous gardez l\'accès jusqu\'a la fin de la période.')
      onOpenChange(false)
      router.refresh()
    } catch {
      toast.error('Erreur lors de l\'annulation.')
      setSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white border border-[#DFE0E1] outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          <div className="flex items-start justify-between border-b border-border p-5">
            <Dialog.Title className="text-lg font-semibold text-text-dark">
              Annuler {productLabel ? `l’abonnement ${productLabel}` : 'votre abonnement'} ?
            </Dialog.Title>
            <Dialog.Close className="text-text-light hover:text-text-dark rounded p-1">
              <X size={18} />
            </Dialog.Close>
          </div>

          <Dialog.Description className="sr-only">
            Confirmation de l&apos;annulation du renouvellement automatique de l&apos;abonnement.
          </Dialog.Description>

          <div className="p-5 space-y-3">
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">
                Votre accès est maintenu jusqu&apos;à la fin de la période déjà payée
                {endDateLabel ? ` (le ${endDateLabel})` : ''}. À cette date, l&apos;abonnement
                prend fin et les fonctionnalités associées sont désactivées.
              </p>
            </div>
            <p className="text-sm text-text-medium">
              Vous pouvez réactiver votre abonnement à tout moment avant la fin de la période.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border p-5">
            <Dialog.Close
              disabled={submitting}
              className="text-sm font-medium px-4 py-2 text-text-medium hover:text-text-dark"
            >
              Garder mon abonnement
            </Dialog.Close>
            <Button
              variant="danger"
              loading={submitting}
              disabled={submitting}
              onClick={handleConfirm}
            >
              Confirmer l&apos;annulation
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
