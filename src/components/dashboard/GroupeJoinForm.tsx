'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui'

export default function GroupeJoinForm({ defaultCode = '' }: { defaultCode?: string }) {
  const router = useRouter()
  const [code, setCode] = useState(defaultCode.toUpperCase())
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!code.trim()) return

    setLoading(true)
    try {
      const res = await fetch('/api/groupes/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de l\'adhésion au groupe.')
        return
      }
      toast.success(`Vous avez rejoint le groupe ${data.nom}.`)
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
        <label htmlFor="groupe-code" className="block text-sm font-medium text-text-dark mb-1">
          Code d&apos;affiliation
        </label>
        <input
          id="groupe-code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={20}
          required
          placeholder="GRP-ABC123"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>
      <Button type="submit" variant="secondary" loading={loading} disabled={!code.trim() || loading}>
        Rejoindre le groupe
      </Button>
    </form>
  )
}
