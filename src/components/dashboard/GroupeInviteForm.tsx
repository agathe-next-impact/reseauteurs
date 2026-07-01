'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Send, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui'

export default function GroupeInviteForm() {
  const [emails, setEmails] = useState<string[]>([''])
  const [sending, setSending] = useState(false)

  function updateEmail(index: number, value: string) {
    setEmails((prev) => prev.map((e, i) => (i === index ? value : e)))
  }

  function addRow() {
    if (emails.length >= 10) return
    setEmails((prev) => [...prev, ''])
  }

  function removeRow(index: number) {
    setEmails((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  async function handleSubmit() {
    const cleaned = emails.map((e) => e.trim()).filter(Boolean)
    if (cleaned.length === 0) {
      toast.error('Saisissez au moins une adresse email.')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/groupes/invité', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: cleaned }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de l\'envoi.')
        return
      }
      const sent = data.sent as number
      const skipped = (data.skipped as number) ?? 0
      const failed = (data.failed as string[]) ?? []
      if (sent > 0) {
        toast.success(
          `${sent} invitation${sent > 1 ? 's' : ''} envoyée${sent > 1 ? 's' : ''}.`,
        )
      }
      if (skipped > 0) {
        toast.info(
          `${skipped} adresse${skipped > 1 ? 's' : ''} déjà membre${skipped > 1 ? 's' : ''} du groupe — ignoree${skipped > 1 ? 's' : ''}.`,
        )
      }
      if (failed.length > 0) {
        toast.error(`${failed.length} échec${failed.length > 1 ? 's' : ''} : ${failed.join(', ')}`)
      }
      if (sent > 0 || skipped > 0) {
        setEmails([''])
      }
    } catch {
      toast.error('Erreur de connexion.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-light">
        Invitez jusqu&apos;a 10 confreres par email. Ils recevront votre code d&apos;affiliation et
        un lien d&apos;inscription.
      </p>
      <div className="space-y-2">
        {emails.map((email, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => updateEmail(i, e.target.value)}
              placeholder="confrere@entreprise.fr"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-primary transition-colors"
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              disabled={emails.length === 1}
              className="p-1.5 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Retirer cette ligne"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={addRow}
          disabled={emails.length >= 10}
          className="inline-flex items-center gap-1.5 text-sm text-text-medium hover:text-text-dark transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        >
          <Plus size={13} />
          Ajouter une ligne
        </button>
        <Button onClick={handleSubmit} loading={sending} iconLeft={Send} size="sm">
          Envoyer les invitations
        </Button>
      </div>
    </div>
  )
}
