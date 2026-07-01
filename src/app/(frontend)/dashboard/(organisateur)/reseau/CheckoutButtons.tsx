'use client'

/**
 * Boutons de checkout Stripe pour le dashboard organisateur.
 *
 * ADR-0012 §3 : l'événement Premium ponctuel est SUPPRIMÉ.
 * PremiumCheckoutButton retiré — plus aucune référence à evenement_premium.
 *
 * CheckoutPartenaireButton : accepte un prop `palier` optionnel ('starter' | 'growth' | 'enterprise').
 * PortalButton             : ouvre le portail Stripe Billing (factures + gestion).
 */
import { useState } from 'react'

interface CheckoutButtonProps {
  reseauId: string | number
  /** Palier d'abonnement national. Défaut : 'starter'. */
  palier?: 'starter' | 'growth' | 'enterprise'
  className?: string
  children: React.ReactNode
}

export function CheckoutPartenaireButton({
  reseauId,
  palier = 'starter',
  className,
  children,
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'reseau_partenaire',
          reseauId: String(reseauId),
          palier,
        }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Erreur lors de la création de la session.')
        return
      }
      window.location.href = data.url
    } catch {
      setError('Erreur réseau. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={loading} className={className}>
        {loading ? 'Chargement…' : children}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

export function PortalButton({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = (await res.json()) as { url?: string }
      if (data.url) window.location.href = data.url
    } catch {
      alert('Erreur lors de la redirection vers le portail. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button type="button" onClick={handleClick} disabled={loading} className={className}>
      {loading ? 'Chargement…' : children}
    </button>
  )
}
