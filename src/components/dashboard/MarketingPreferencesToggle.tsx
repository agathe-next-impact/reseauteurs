'use client'

import { useState } from 'react'
import { toast } from 'sonner'

interface Props {
  initialValue: boolean
}

export default function MarketingPreferencesToggle({ initialValue }: Props) {
  const [enabled, setEnabled] = useState(initialValue)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    const next = !enabled
    setLoading(true)
    try {
      const res = await fetch('/api/account/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optInMarketing: next }),
      })
      if (!res.ok) throw new Error('request failed')
      setEnabled(next)
      toast.success(
        next
          ? 'Vous recevrez désormais nos emails d\'information.'
          : 'Vous ne recevrez plus d\'emails marketing.',
      )
    } catch {
      toast.error('Erreur lors de la mise a jour. Reessayez.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={loading}
      onClick={toggle}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 ${
        enabled ? 'bg-primary' : 'bg-gray-200'
      }`}
    >
      <span className="sr-only">
        {enabled ? 'Désactiver les emails marketing' : 'Activer les emails marketing'}
      </span>
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white ring-0 transition-transform ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
