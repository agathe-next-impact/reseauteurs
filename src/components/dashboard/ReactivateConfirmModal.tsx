'use client'

import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function ReactivateConfirmModal({ open, onOpenChange }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/stripe/reactivate', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de la reactivation.')
        setSubmitting(false)
        return
      }
      toast.success('Renouvellement automatique reactive !')
      onOpenChange(false)
      router.refresh()
    } catch {
      toast.error('Erreur lors de la reactivation.')
      setSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white shadow-xl outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          <div className="flex items-start justify-between border-b border-border p-5">
            <Dialog.Title className="text-lg font-semibold text-text-dark">
              Reactiver le renouvellement automatique ?
            </Dialog.Title>
            <Dialog.Close className="text-text-light hover:text-text-dark rounded p-1">
              <X size={18} />
            </Dialog.Close>
          </div>

          <Dialog.Description className="sr-only">
            Confirmation de la reactivation du renouvellement automatique.
          </Dialog.Description>

          <div className="p-5">
            <p className="text-sm text-text-medium">
              Votre abonnement sera renouvelé automatiquement à la fin de la période en cours.
              Vous pourrez de nouveau changer de plan immediatement.
            </p>
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
              disabled={submitting}
              onClick={handleConfirm}
            >
              Confirmer la reactivation
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
