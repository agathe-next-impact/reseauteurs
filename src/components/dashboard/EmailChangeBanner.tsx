'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

/**
 * Lit `?email=success|expired|taken|error` dans l'URL après redirection depuis
 * /api/account/confirm-email-change et déclenché le toast correspondant, puis
 * nettoie la query pour eviter de re-toaster au moindre re-render.
 */
export default function EmailChangeBanner() {
  const router = useRouter()
  const params = useSearchParams()
  const status = params.get('email')

  useEffect(() => {
    if (!status) return
    switch (status) {
      case 'success':
        toast.success('Votre adresse email a été mise a jour.')
        break
      case 'expired':
        toast.error('Ce lien de confirmation est invalide ou expire. Relancez la demande.')
        break
      case 'taken':
        toast.error('Cette adresse a été enregistrée par un autre compte entre-temps. Relancez avec une autre adresse.')
        break
      case 'error':
        toast.error('Erreur lors de la confirmation du changement d\'email.')
        break
      default:
        return
    }
    router.replace('/dashboard/compte', { scroll: false })
  }, [status, router])

  return null
}
