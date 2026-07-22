'use client'

/**
 * OffreReservee — Offre partenaire réservée aux réseauteurs, hydratée côté client.
 *
 * La fiche partenaire reste ISR/statique : l'état per-user (le viewer est-il
 * réseauteur ?) et le CONTENU de l'offre sont chargés via GET /api/partenaires/<slug>/offre
 * (le contenu n'entre donc jamais dans le HTML statique). Rendu uniquement si une
 * offre existe (`hasOffre` fourni par le serveur, booléen public).
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Tag, Lock } from 'lucide-react'

interface OffreContenu {
  titre: string
  description: string | null
  lien: string | null
}

export default function OffreReservee({ slug }: { slug: string }) {
  const [state, setState] = useState<{ canSee: boolean; offre?: OffreContenu } | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/partenaires/${encodeURIComponent(slug)}/offre`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j) setState({ canSee: !!j.canSee, offre: j.offre })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [slug])

  return (
    <section aria-labelledby="offre-titre">
      <h2 id="offre-titre" className="text-sm font-semibold text-[#1D1E21] mb-3 flex items-center gap-1.5">
        <Tag size={14} className="text-[#8A6D0B]" aria-hidden />
        Offre réservée aux réseauteurs
      </h2>

      {/* Chargement : garde la hauteur pour éviter le saut de mise en page */}
      {state === null ? (
        <div className="rounded-xl border border-dashed border-[#DFE0E1] bg-[#F2F2F2] p-4 min-h-[64px] animate-pulse" aria-hidden />
      ) : state.canSee && state.offre ? (
        <div className="rounded-xl border border-[#EFE08F] bg-[#FEFBE6] p-4">
          <p className="text-sm font-bold text-[#8A6D0B]">{state.offre.titre}</p>
          {state.offre.description && (
            <p className="text-sm text-[#6E5608] mt-1.5 whitespace-pre-line">{state.offre.description}</p>
          )}
          {state.offre.lien && (
            <a
              href={state.offre.lien}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 bg-[#F5E050] text-[#012A4A] font-semibold p-2.5 rounded-xl hover:bg-[#E3CB2E] transition-colors text-sm no-underline"
            >
              En profiter 
            </a>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#DFE0E1] bg-[#F2F2F2] p-4 flex items-start gap-3">
          <Lock size={16} className="text-[#999A9D] shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-sm text-[#4E5155]">Cette offre est réservée aux réseauteurs.</p>
            <Link href="/inscription" className="text-sm text-[#035AA6] font-medium no-underline">
              Créez votre compte réseauteur gratuit →
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}
