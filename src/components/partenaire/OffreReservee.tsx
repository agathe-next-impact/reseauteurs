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
import { Tag, Lock, ExternalLink } from 'lucide-react'

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
      <h2 id="offre-titre" className="text-sm font-semibold text-[#18181b] mb-3 flex items-center gap-1.5">
        <Tag size={14} className="text-[#f5851f]" aria-hidden />
        Offre réservée aux réseauteurs
      </h2>

      {/* Chargement : garde la hauteur pour éviter le saut de mise en page */}
      {state === null ? (
        <div className="rounded-xl border border-dashed border-[#e4e4e7] bg-[#faf9f5] p-4 min-h-[64px] animate-pulse" aria-hidden />
      ) : state.canSee && state.offre ? (
        <div className="rounded-xl border border-[#fed7aa] bg-[#fff7ed] p-4">
          <p className="text-sm font-bold text-[#c2410c]">{state.offre.titre}</p>
          {state.offre.description && (
            <p className="text-sm text-[#9a3412] mt-1.5 whitespace-pre-line">{state.offre.description}</p>
          )}
          {state.offre.lien && (
            <a
              href={state.offre.lien}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 bg-[#f5851f] text-white font-semibold py-2 px-4 rounded-xl hover:bg-[#e07710] transition-colors text-sm no-underline"
            >
              En profiter <ExternalLink size={13} aria-hidden />
            </a>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#e4e4e7] bg-[#faf9f5] p-4 flex items-start gap-3">
          <Lock size={16} className="text-[#a1a1aa] shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-sm text-[#52525b]">Cette offre est réservée aux réseauteurs.</p>
            <Link href="/inscription" className="text-sm text-[#2563EB] font-medium no-underline">
              Créez votre compte réseauteur gratuit →
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}
