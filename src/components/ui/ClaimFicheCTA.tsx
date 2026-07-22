'use client'

import Link from 'next/link'

// La page parente ne rend ce CTA que pour une fiche orpheline. Le flux
// /inscription?claim=... revalide ensuite cote API que la fiche est toujours
// revendiquable.
export function ClaimFicheCTA({ ficheId }: { ficheId: number | string }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
      <p className="text-sm text-text-dark font-medium mb-1">
        C&apos;est votre entreprise ?
      </p>
      <p className="text-sm text-text-medium mb-3">
        Revendiquez cette fiche pour la compléter et contrôler les informations affichees.
      </p>
      <Link
        href={`/inscription?claim=${ficheId}`}
        className="inline-flex items-center justify-center p-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors text-sm no-underline"
      >
        Revendiquer ma fiche
      </Link>
    </div>
  )
}
