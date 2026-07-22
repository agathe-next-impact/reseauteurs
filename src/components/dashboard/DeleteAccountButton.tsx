'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function DeleteAccountButton() {
  const [step, setStep] = useState<'idle' | 'confirm' | 'final'>('idle')
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de la suppression.')
        return
      }
      toast.success('Compte supprimé.')
      window.location.href = '/'
    } catch {
      toast.error('Erreur lors de la suppression.')
    } finally {
      setLoading(false)
      setStep('idle')
    }
  }

  if (step === 'idle') {
    return (
      <button
        onClick={() => setStep('confirm')}
        className="text-sm text-red-500 hover:text-red-600 underline underline-offset-2"
      >
        Supprimer mon compte
      </button>
    )
  }

  if (step === 'confirm') {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-700 mb-2">
          Cette action est <strong>irreversible</strong>. Votre fiche, vos événements et votre
          abonnement seront definitivement supprimés.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setStep('final')}
            className="text-sm font-medium p-2.5 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Je comprends, continuer
          </button>
          <button
            onClick={() => setStep('idle')}
            className="text-sm font-medium p-2.5 bg-white text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Annuler
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 bg-red-50 border border-red-300 rounded-lg">
      <p className="text-sm text-red-800 font-semibold mb-2">
        Dernière confirmation : supprimer definitivement votre compte ?
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-sm font-medium p-2.5 bg-red-700 text-white rounded-md hover:bg-red-800 disabled:opacity-50"
        >
          {loading ? <><Loader2 size={14} className="inline animate-spin mr-1" />Suppression...</> : 'Supprimer definitivement'}
        </button>
        <button
          onClick={() => setStep('idle')}
          disabled={loading}
          className="text-sm font-medium p-2.5 bg-white text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Non, garder mon compte
        </button>
      </div>
    </div>
  )
}
