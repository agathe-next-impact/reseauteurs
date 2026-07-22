'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Mail, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import AuthShell from '@/components/layout/AuthShell'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/users/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      // Always show success to prevent email énumération
      setSent(true)

      if (!res.ok) {
        // Log silently, don't reveal to user
        console.warn('[forgot-password] Request failed for:', email)
      }
    } catch {
      toast.error('Erreur de connexion. Reessayez.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <AuthShell title="Email envoyé">
        <div className="text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={28} className="text-green-600" />
          </div>
          <p className="text-sm text-text-light mb-6">
            Si un compte existe avec l&apos;adresse <strong className="text-text-dark">{email}</strong>,
            vous recevrez un lien de réinitialisation dans quelques minutes.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center p-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors text-sm no-underline"
          >
            Retour à la connexion
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Mot de passe oublié ?"
      subtitle="Réinitialisation du mot de passe"
      footer={
        <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
          Retour à la connexion
        </Link>
      }
    >
      <p className="text-sm text-text-light mb-6">
        Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-text-medium mb-1.5">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-primary transition-colors"
            placeholder="vous@entreprise.fr"
          />
        </div>

        <Button type="submit" loading={loading} iconLeft={Mail} className="w-full" size="md">
          Envoyer le lien
        </Button>
      </form>
    </AuthShell>
  )
}
