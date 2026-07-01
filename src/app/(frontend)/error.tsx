'use client'

import { useEffect } from 'react'

export default function FrontendError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[frontend] Error:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-2xl font-bold text-gray-900">Une erreur est survenue</h1>
      <p className="max-w-md text-gray-600">
        Nous sommes désolés, quelque chose s&apos;est mal passe. Veuillez réessayer ou revenir a
        l&apos;accueil.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Réessayer
        </button>
        <a
          href="/"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Retour a l&apos;accueil
        </a>
      </div>
    </div>
  )
}
