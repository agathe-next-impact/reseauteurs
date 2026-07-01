'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { toast } from 'sonner'
import { Lock, Check, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  if (!token) {
    return (
      <div className="min-h-[calc(100vh-56px)] bg-gradient-to-br from-blue-50 to-white flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 text-2xl font-bold text-primary no-underline"
            >
              <Image src="/img/logo.png" alt="" width={40} height={40} priority />
              <span>RÉSEAUTEURS</span>
            </Link>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} className="text-red-600" />
            </div>
            <h1 className="text-xl font-semibold text-red-600 mb-2">Lien invalide</h1>
            <p className="text-sm text-text-light">
              Ce lien de réinitialisation est invalide ou a expire.
            </p>
          </div>
          <p className="text-center mt-6">
            <Link
              href="/mot-de-passe-oublie"
              className="text-sm font-medium text-primary hover:text-primary-hover"
            >
              Demander un nouveau lien
            </Link>
          </p>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    if (password !== passwordConfirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      if (res.ok) {
        setSuccess(true)
      } else {
        const data = await res.json().catch(() => null)
        setError(
          data?.errors?.[0]?.message || 'Le lien de réinitialisation est invalide ou a expire.',
        )
      }
    } catch {
      toast.error('Erreur de connexion. Reessayez.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-[calc(100vh-56px)] bg-gradient-to-br from-blue-50 to-white flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 text-2xl font-bold text-primary no-underline"
            >
              <Image src="/img/logo.png" alt="" width={40} height={40} priority />
              <span>RÉSEAUTEURS</span>
            </Link>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={28} className="text-green-600" />
            </div>
            <h1 className="text-xl font-semibold text-text-dark mb-2">Mot de passe modifié</h1>
            <p className="text-sm text-text-light mb-6">
              Votre mot de passe a été réinitialisé avec succès.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors text-sm no-underline"
            >
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-br from-blue-50 to-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 text-2xl font-bold text-primary no-underline"
          >
            <Image src="/img/logo.png" alt="" width={40} height={40} priority />
            <span>RÉSEAUTEURS</span>
          </Link>
          <p className="text-sm text-text-light mt-1">Nouveau mot de passe</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <h1 className="text-xl font-semibold text-text-dark mb-6">
            Réinitialiser le mot de passe
          </h1>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-text-medium mb-1.5"
              >
                Nouveau mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-primary transition-colors"
                placeholder="Minimum 8 caractères"
              />
            </div>

            <div>
              <label
                htmlFor="passwordConfirm"
                className="block text-sm font-medium text-text-medium mb-1.5"
              >
                Confirmer le mot de passe
              </label>
              <input
                id="passwordConfirm"
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-primary transition-colors"
                placeholder="Retapez votre mot de passe"
              />
            </div>

            <Button type="submit" loading={loading} iconLeft={Lock} className="w-full" size="md">
              Réinitialiser
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-text-light mt-6">
          <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
            Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-56px)] bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}
