'use client'

/**
 * OffreReservee — Offre partenaire, hydratée côté client.
 *
 * La fiche partenaire reste ISR/statique : l'état per-user (le viewer peut-il ACTIVER
 * l'offre ?) et le contenu sont chargés via GET /api/partenaires/<slug>/offre.
 *
 * Le teaser (titre + description) est affiché à TOUT LE MONDE ; le lien « En profiter »
 * n'est actif que pour les réseauteurs connectés (canActivate). Les autres voient l'offre
 * mais sont invités à créer un compte réseauteur pour en profiter. Rendu uniquement si une
 * offre existe (`hasOffre` fourni par le serveur, booléen public).
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Tag, Lock } from 'lucide-react'

interface OffreContenu {
  titre: string
  description: string | null
  lien: string | null // présent uniquement si canActivate
}

export default function OffreReservee({ slug }: { slug: string }) {
  const [state, setState] = useState<{ canActivate: boolean; offre?: OffreContenu } | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/partenaires/${encodeURIComponent(slug)}/offre`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j?.offre) setState({ canActivate: !!j.canActivate, offre: j.offre })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [slug])

  return (
    <section id="offre" aria-labelledby="offre-titre" className="scroll-mt-24">
      <h2 id="offre-titre" className="text-sm font-semibold text-[#1D1E21] mb-3 flex items-center gap-1.5">
        <Tag size={14} className="text-[#8A6D0B]" aria-hidden />
        Offre réservée aux réseauteurs
      </h2>

      {/* Chargement : garde la hauteur pour éviter le saut de mise en page */}
      {state === null ? (
        <div className="rounded-xl border border-dashed border-[#DFE0E1] bg-[#F2F2F2] p-4 min-h-[64px] animate-pulse" aria-hidden />
      ) : state.offre ? (
        <div className="rounded-xl border border-[#EFE08F] bg-[#FEFBE6] p-4">
          {/* Teaser public : titre + description toujours visibles */}
          <p className="text-sm font-bold text-[#8A6D0B]">{state.offre.titre}</p>
          {state.offre.description && (
            <p className="text-sm text-[#6E5608] mt-1.5 whitespace-pre-line">{state.offre.description}</p>
          )}

          {state.canActivate && state.offre.lien ? (
            // Réseauteur connecté : offre active
            <a
              href={state.offre.lien}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 bg-[#F5E050] text-[#012A4A] font-semibold p-2.5 rounded-xl hover:bg-[#E3CB2E] transition-colors text-sm no-underline"
            >
              En profiter
            </a>
          ) : (
            // Offre non active : visible mais réservée — inviter à s'inscrire
            <div className="mt-3 flex items-start gap-2 border-t border-[#EFE08F] pt-3">
              <Lock size={15} className="text-[#8A6D0B] shrink-0 mt-0.5" aria-hidden />
              <p className="text-sm text-[#6E5608]">
                Pour profiter de cette offre,{' '}
                <Link href="/inscription" className="text-[#035AA6] font-semibold no-underline">
                  créez votre compte réseauteur gratuit →
                </Link>
              </p>
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}
