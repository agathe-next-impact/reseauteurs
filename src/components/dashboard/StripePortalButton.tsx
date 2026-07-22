'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui'

export default function StripePortalButton() {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) {
        toast.error(data.error || 'Impossible d\'ouvrir le portail Stripe.')
        setLoading(false)
        return
      }
      window.location.href = data.url
    } catch {
      toast.error('Erreur lors de l\'ouverture du portail Stripe.')
      setLoading(false)
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      loading={loading}
      disabled={loading}
      onClick={handleClick}
    >
      {loading ? 'Ouverture du portail...' : 'Gérer mon moyen de paiement et mes factures'}
    </Button>
  )
}
