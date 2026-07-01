'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { LogIn } from 'lucide-react'
import { Button } from '@/components/ui/Button'

/**
 * Only allow same-origin paths to defeat open-redirect attacks. Must start
 * with a single "/", must not start with "//" or "/\", and must not contain
 * a scheme-style ":" before the first "/" (paranoia, kept simple).
 */
function safeRedirect(raw: string | null): string {
  if (!raw) return '/dashboard'
  if (!raw.startsWith('/')) return '/dashboard'
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/dashboard'
  return raw
}

/**
 * Traduit les messages d'erreur Payload (anglais) en francais.
 * Payload renvoie ces strings tels quels dans data.errors[0].message — pas
 * de code stable, donc on match sur des sous-chaines representatives.
 */
function translateLoginError(raw: string | undefined, status: number): string {
  const msg = (raw || '').toLowerCase()
  if (msg.includes('locked')) {
    return 'Compte temporairement verrouille apres trop de tentatives. Reessayez dans 10 minutes ou reinitialisez votre mot de passe.'
  }
  if (msg.includes('verify') || msg.includes('verified')) {
    return "Votre adresse email n'est pas encore verifiee. Consultez votre boite mail pour activer votre compte."
  }
  if (msg.includes('incorrect') || msg.includes('invalid') || status === 401) {
    return 'Email ou mot de passe incorrect.'
  }
  if (status === 429) {
    return 'Trop de tentatives. Patientez quelques minutes avant de reessayer.'
  }
  if (status >= 500) {
    return 'Le service est temporairement indisponible. Reessayez dans quelques instants.'
  }
  return 'Connexion impossible. Verifiez vos identifiants et reessayez.'
}

export default function LoginPage() {
  const searchParams = useSearchParams()
  const redirectTo = safeRedirect(searchParams.get('redirect'))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const form = new FormData(e.currentTarget)

    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.get('email'),
          password: form.get('password'),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const rawMsg = data?.errors?.[0]?.message || data?.message
        setError(translateLoginError(rawMsg, res.status))
        setLoading(false)
        return
      }

      // Hard navigation rather than router.push() : guarantees the
      // payload-token Set-Cookie is applied before the next request, and
      // forces (frontend)/layout.tsx to re-render so AuthNav reflects the
      // logged-in state. A soft navigation reuses the layout RSC computed
      // pre-login and leaves the header showing "Connexion / Inscription".
      window.location.assign(redirectTo)
    } catch {
      toast.error('Erreur de connexion. Reessayez.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-br from-blue-50 to-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 text-2xl font-bold text-primary no-underline"
          >
            <Image src="/img/logo.png" alt="" width={40} height={40} priority />
            <span>RÉSEAUTEURS</span>
          </Link>
          <p className="text-sm text-text-light mt-1">Connexion à votre espace</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <h1 className="text-xl font-semibold text-text-dark mb-6">Se connecter</h1>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-text-medium mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-primary transition-colors"
                placeholder="vous@entreprise.fr"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-text-medium mb-1.5"
              >
                Mot de passe
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-primary transition-colors"
                placeholder="Votre mot de passe"
              />
            </div>

            <Button type="submit" loading={loading} iconLeft={LogIn} className="w-full" size="md">
              Se connecter
            </Button>

            <div className="text-right">
              <Link
                href="/mot-de-passe-oublie"
                className="text-sm text-text-light hover:text-primary transition-colors"
              >
                Mot de passe oublié ?
              </Link>
            </div>
          </form>
        </div>

        {/* Footer links */}
        <p className="text-center text-sm text-text-light mt-6">
          Pas encore de compte ?{' '}
          <Link href="/inscription" className="font-medium text-primary hover:text-primary-hover">
            S&apos;inscrire
          </Link>
        </p>
        <p className="text-center mt-2">
          <Link
            href="/"
            className="text-sm text-text-light hover:text-text-medium transition-colors"
          >
            Retour a l&apos;accueil
          </Link>
        </p>
      </div>
    </div>
  )
}
