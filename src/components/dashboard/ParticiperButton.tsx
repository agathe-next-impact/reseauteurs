'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { UserPlus, UserMinus, Loader2 } from 'lucide-react'

interface ParticiperButtonProps {
  eventId: number
  initialParticipating: boolean
}

export default function ParticiperButton({ eventId, initialParticipating }: ParticiperButtonProps) {
  const [participating, setParticipating] = useState(initialParticipating)
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    setLoading(true)
    try {
      const res = await fetch(`/api/evenements/${eventId}/participer`, {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json()
        setParticipating(data.participating)
        toast.success(data.participating ? 'Participation signalée !' : 'Participation retiree.')
      } else {
        const err = await res.json()
        toast.error(err.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur de connexion.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`inline-flex items-center gap-2 p-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
        participating
          ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
          : 'bg-primary text-white hover:bg-primary-hover'
      }`}
    >
      {loading ? (
        <Loader2 size={15} className="animate-spin" />
      ) : participating ? (
        <UserMinus size={15} />
      ) : (
        <UserPlus size={15} />
      )}
      {participating ? 'Annuler ma participation' : 'Je participe'}
    </button>
  )
}
