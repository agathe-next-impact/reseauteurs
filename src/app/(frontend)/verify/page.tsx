'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Check, AlertTriangle, Loader2 } from 'lucide-react'

function VerifyContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(token ? 'loading' : 'error')
  const [message, setMessage] = useState(token ? '' : 'Token de vérification manquant.')

  useEffect(() => {
    if (!token) return

    fetch(`/api/users/verify/${token}`, { method: 'POST' })
      .then(async (res) => {
        if (res.ok) {
          setStatus('success')
        } else {
          const data = await res.json().catch(() => null)
          setStatus('error')
          setMessage(
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

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-br from-blue-50 to-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center gap-2 text-2xl font-bold text-primary no-underline">
            <Image src="/img/logo.png" alt="" width={40} height={40} priority />
            <span>RÉSEAUTEURS</span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
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
              <h1 className="text-xl font-semibold text-text-dark mb-2">Email vérifié !</h1>
              <p className="text-sm text-text-light mb-6">
                Votre compte est maintenant actif. Vous pouvez vous connecter.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors text-sm no-underline"
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
              <h1 className="text-xl font-semibold text-red-600 mb-2">Échec de la vérification</h1>
              <p className="text-sm text-text-light">{message}</p>
            </>
          )}
        </div>

        <p className="text-center mt-6">
          <Link href="/" className="text-sm text-text-light hover:text-text-medium transition-colors">
            Retour a l&apos;accueil
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-56px)] bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  )
}
