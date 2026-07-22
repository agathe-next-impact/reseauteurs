'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Copy, Check, LogOut } from 'lucide-react'
import { Button } from '@/components/ui'

interface GroupeMemberViewProps {
  nom: string
  code: string
  palierActuel: '0' | '5' | '10' | '15'
  membresTotal: number
  membresPayants: number
  isOwner: boolean
}

const palierBadgeClasses: Record<'0' | '5' | '10' | '15', string> = {
  '0': 'bg-gray-100 text-gray-600 border border-gray-300',
  '5': 'bg-emerald-50 text-emerald-700 border border-emerald-300',
  '10': 'bg-emerald-100 text-emerald-800 border border-emerald-400',
  '15': 'bg-emerald-100 text-emerald-800 border border-emerald-400',
}

/**
 * Tells the user how many additional paying members are needed to unlock the
 * next discount tier (or null if they're already at the top).
 */
function nextTierMessage(membresPayants: number): string | null {
  if (membresPayants < 3) {
    return `${3 - membresPayants} membre${3 - membresPayants > 1 ? 's' : ''} payant${
      3 - membresPayants > 1 ? 's' : ''
    } supplementaire${3 - membresPayants > 1 ? 's' : ''} pour atteindre -5%`
  }
  if (membresPayants < 5) {
    return `${5 - membresPayants} membre${5 - membresPayants > 1 ? 's' : ''} payant${
      5 - membresPayants > 1 ? 's' : ''
    } supplementaire${5 - membresPayants > 1 ? 's' : ''} pour atteindre -10%`
  }
  if (membresPayants < 10) {
    return `${10 - membresPayants} membre${10 - membresPayants > 1 ? 's' : ''} payant${
      10 - membresPayants > 1 ? 's' : ''
    } supplementaire${10 - membresPayants > 1 ? 's' : ''} pour atteindre -15%`
  }
  return null
}

export default function GroupeMemberView({
  nom,
  code,
  palierActuel,
  membresTotal,
  membresPayants,
  isOwner,
}: GroupeMemberViewProps) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [leaving, setLeaving] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success('Code copie dans le presse-papier')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Impossible de copier le code')
    }
  }

  async function handleLeave() {
    setLeaving(true)
    try {
      const res = await fetch('/api/groupes/leave', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur lors du depart du groupe.')
        return
      }
      toast.success(
        data.groupeDeleted
          ? 'Vous avez quitte le groupe (supprimé car vide).'
          : 'Vous avez quitte le groupe.',
      )
      router.refresh()
    } catch {
      toast.error('Erreur de connexion.')
    } finally {
      setLeaving(false)
      setConfirming(false)
    }
  }

  const nextMessage = nextTierMessage(membresPayants)

  const leaveConfirmMessage = (() => {
    if (!isOwner) {
      return 'Vous perdrez la réduction de groupe sur votre prochain renouvellement. Confirmer ?'
    }
    if (membresTotal <= 1) {
      return 'Vous êtes le dernier membre : le groupe et son code d\'affiliation seront supprimés. Confirmer ?'
    }
    return 'Le membre le plus ancien deviendra proprietaire du groupe. Vous perdrez la réduction. Confirmer ?'
  })()

  return (
    <div className="space-y-5">
      {/* Group identity */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-light mb-1">
          Nom du groupe
        </h3>
        <p className="text-lg font-bold text-text-dark">{nom}</p>
        {isOwner && (
          <p className="text-sm text-text-light mt-1">(Vous êtes le proprietaire de ce groupe)</p>
        )}
      </div>

      {/* Affiliation code */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-light mb-1">
          Code d&apos;affiliation
        </h3>
        <div className="flex items-center gap-2">
          <code className="px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-md font-mono text-sm">
            {code}
          </code>
          <button
            onClick={handleCopy}
            className="p-2.5 text-text-light hover:text-text-dark transition-colors cursor-pointer"
            aria-label="Copier le code"
          >
            {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
          </button>
        </div>
        <p className="text-sm text-text-light mt-1">
          Partagez ce code pour faire grandir votre groupe et débloquer plus de réductions.
        </p>
      </div>

      {/* Current tier */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-light mb-2">
          Palier actuel
        </h3>
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${palierBadgeClasses[palierActuel]}`}
        >
          -{palierActuel}%
        </span>
        {nextMessage && (
          <p className="text-sm text-text-light mt-2">{nextMessage}</p>
        )}
      </div>

      {/* Members count */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-light mb-1">
            Membres total
          </h3>
          <p className="text-xl font-bold text-text-dark">{membresTotal}</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-light mb-1">
            Membres payants
          </h3>
          <p className="text-xl font-bold text-text-dark">{membresPayants}</p>
        </div>
      </div>

      {/* Leave button + confirmation */}
      <div className="pt-4 border-t border-border-light">
        {!confirming ? (
          <Button variant="ghost" iconLeft={LogOut} onClick={() => setConfirming(true)}>
            Quitter le groupe
          </Button>
        ) : (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700 flex-1">
              {leaveConfirmMessage}
            </p>
            <Button
              variant="danger"
              size="sm"
              loading={leaving}
              disabled={leaving}
              onClick={handleLeave}
            >
              Confirmer
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={leaving}
              onClick={() => setConfirming(false)}
            >
              Non
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
