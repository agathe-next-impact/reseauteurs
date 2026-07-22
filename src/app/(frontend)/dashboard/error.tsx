'use client'

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[dashboard] Error:', error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-xl font-bold text-gray-900">Erreur</h1>
      <p className="max-w-md text-gray-600">
        Une erreur est survenue dans votre espace. Veuillez réessayer.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-blue-600 p-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Réessayer
        </button>
        <a
          href="/dashboard"
          className="rounded-md border border-gray-300 p-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Retour au tableau de bord
        </a>
      </div>
    </div>
  )
}
