'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui'

export default function GroupeCreateForm() {
  const router = useRouter()
  const [nom, setNom] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!nom.trim()) return

    setLoading(true)
    try {
      const res = await fetch('/api/groupes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: nom.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de la création du groupe.')
        return
      }
      toast.success(`Groupe créé ! Code d'affiliation : ${data.code}`)
      router.refresh()
    } catch {
      toast.error('Erreur de connexion.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="groupe-nom" className="block text-sm font-medium text-text-dark mb-1">
          Nom du groupe
        </label>
        <input
          id="groupe-nom"
          type="text"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          maxLength={120}
          required
          placeholder="Ex: Groupe Dupont SA"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>
      <Button type="submit" loading={loading} disabled={!nom.trim() || loading}>
        Créer le groupe
      </Button>
    </form>
  )
}
