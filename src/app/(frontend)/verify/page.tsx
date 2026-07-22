'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Check, AlertTriangle, Loader2 } from 'lucide-react'
import AuthShell from '@/components/layout/AuthShell'

function VerifyContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(token ? 'loading' : 'error')
  const [message, setMessage] = useState(token ? '' : 'Token de vérification manquant.')

  useEffect(() => {
    if (!token) return

    // Route maison (et non /api/users/verify/:token) : elle enveloppe la vérification
    // native de Payload et applique la revendication de fiche mise en attente au
    // signup — l'email doit être prouvé avant qu'une fiche change de mains.
    fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.ok) {
          setStatus('success')
        } else {
          const data = await res.json().catch(() => null)
          setStatus('error')
          setMessage(
            data?.error ||
              data?.errors?.[0]?.message ||
              data?.message ||
              'Le lien de vérification est invalide ou a expire.',
          )
        }
      })
      .catch(() => {
        setStatus('error')
        setMessage('Erreur de connexion. Reessayez.')
      })
  }, [token])

  const title =
    status === 'success'
      ? 'Email vérifié !'
      : status === 'error'
        ? 'Échec de la vérification'
        : 'Vérification en cours'

  return (
    <AuthShell
      title={title}
      footer={
        <Link href="/" className="text-sm text-text-light hover:text-text-medium transition-colors">
          Retour a l&apos;accueil
        </Link>
      }
    >
      <div className="text-center">
        {status === 'loading' && (
          <div className="py-8">
            <Loader2 size={40} className="animate-spin text-primary mx-auto mb-4" />
            <p className="text-sm text-text-light">Verification en cours...</p>
          </div>
        )}

        {status === 'success' && (
          <>
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={28} className="text-green-600" />
            </div>
            <p className="text-sm text-text-light mb-6">
              Votre compte est maintenant actif. Vous pouvez vous connecter.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center p-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors text-sm no-underline"
            >
              Se connecter
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} className="text-red-600" />
            </div>
            <p className="text-sm text-text-light">{message}</p>
          </>
        )}
      </div>
    </AuthShell>
  )
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-56px)] bg-[#F2F2F2] flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  )
}
