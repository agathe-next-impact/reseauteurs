'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Pencil, X, Loader2, MailCheck } from 'lucide-react'

interface Props {
  currentEmail: string
}

type Mode = 'view' | 'editing' | 'pending'

export default function ChangeEmailForm({ currentEmail }: Props) {
  const [mode, setMode] = useState<Mode>('view')
  const [newEmail, setNewEmail] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sentTo, setSentTo] = useState('')

  function resetForm() {
    setNewEmail('')
    setConfirmEmail('')
    setPassword('')
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()

    const normalized = newEmail.trim().toLowerCase()
    if (normalized === currentEmail.toLowerCase()) {
      toast.error('La nouvelle adresse doit être différente de l\'actuelle.')
      return
    }
    if (normalized !== confirmEmail.trim().toLowerCase()) {
      toast.error('Les deux adresses email ne correspondent pas.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/account/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: normalized, password }),
      })
      if (res.status === 401) {
        toast.error('Mot de passe incorrect.')
        return
      }
      if (res.status === 409) {
        toast.error('Cet email est déjà utilise.')
        return
      }
      if (res.status === 429) {
        toast.error('Trop de tentatives. Reessayez dans une minute.')
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? 'Erreur lors de la demande de changement.')
        return
      }
      setSentTo(normalized)
      setMode('pending')
      resetForm()
    } catch {
      toast.error('Erreur reseau. Reessayez.')
    } finally {
      setSubmitting(false)
    }
  }

  if (mode === 'pending') {
    return (
      <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 w-full">
        <MailCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-text-dark">
            Lien de confirmation envoyé a <span className="text-emerald-700">{sentTo}</span>
          </p>
          <p className="text-sm text-text-light mt-1">
            Cliquez sur le lien dans cet email pour finaliser. Il est valable 24h. Tant que vous
            n&apos;avez pas clique, votre adresse actuelle reste active.
          </p>
          <button
            type="button"
            onClick={() => setMode('view')}
            className="mt-2 text-sm font-medium text-primary hover:text-primary-hover transition-colors cursor-pointer bg-transparent border-none p-2.5"
          >
            Fermer
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'editing') {
    return (
      <form onSubmit={onSubmit} className="flex flex-col gap-3 w-full">
        <div>
          <label className="block text-sm text-text-light mb-1" htmlFor="newEmail">
            Nouvelle adresse email
          </label>
          <input
            id="newEmail"
            type="email"
            required
            autoComplete="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm text-text-light mb-1" htmlFor="confirmEmail">
            Confirmez la nouvelle adresse
          </label>
          <input
            id="confirmEmail"
            type="email"
            required
            autoComplete="email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm text-text-light mb-1" htmlFor="password">
            Mot de passe actuel
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-sm text-text-light mt-1">
            Requis pour protéger votre compte. Un lien de confirmation sera envoyé à la nouvelle
            adresse.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 p-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Envoyer le lien de confirmation
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('view')
              resetForm()
            }}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 p-2.5 bg-transparent text-text-medium rounded-lg text-sm hover:text-text-dark transition-colors cursor-pointer border-none disabled:opacity-50"
          >
            <X size={14} />
            Annuler
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex items-center justify-between gap-4 w-full">
      <span className="text-sm font-medium text-text-dark break-all">{currentEmail}</span>
      <button
        type="button"
        onClick={() => setMode('editing')}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover transition-colors cursor-pointer bg-transparent border-none p-2.5 shrink-0"
      >
        <Pencil size={13} />
        Modifier
      </button>
    </div>
  )
}
