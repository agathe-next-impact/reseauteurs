/**
 * MaillageReseau — maillage interne sur la fiche réseau LOCAL.
 * Server Component : fetch direct depuis Payload (SSR/ISR — pas de client waterfall).
 *
 * Affiche les autres chapitres locaux rattachés au même réseau national
 * (« Autres chapitres de [NomNational] »). Renforce le maillage interne entre
 * fiches locales d'une même marque et guide l'utilisateur vers la fiche nationale.
 *
 * Contexte ADR-0012 §7 — maillage « même national » : chaque chapitre local doit
 * pouvoir naviguer vers ses frères (sibling chapters) et vers le national parent.
 * Cette section s'affiche UNIQUEMENT sur les fiches réseau de niveau local.
 *
 * Vide (0 sibling publié) → null (aucune section rendue, pas de balisage vide).
 *
 * ─── Usage (dans /reseau/[slug]/page.tsx, conditionnel sur reseau.niveau) ────────
 *
 *   {reseau.niveau === 'local' && parentDoc && (
 *     <MaillageReseau
 *       excludeId={reseau.id}
 *       nationalId={parentDoc.id}
 *       nationalSlug={parentDoc.slug}
 *       nationalNom={parentDoc.nom}
 *     />
 *   )}
 */
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'
import { Network, ArrowRight } from 'lucide-react'

interface Props {
  /** ID du réseau courant (local) — exclu des résultats pour ne pas s'afficher lui-même */
  excludeId: number | string
  /** ID du réseau national parent (pour filtrer les siblings) */
  nationalId: number | string
  /** Slug du réseau national (pour le lien « Voir [NomNational] ») */
  nationalSlug?: string | null
  /** Nom du réseau national (pour le titre de section et le lien) */
  nationalNom: string
}

type ReseauSiblingLite = {
  id: number | string
  slug?: string | null
  nom: string
  ville?: string | null
}

export async function MaillageReseau({
  excludeId,
  nationalId,
  nationalSlug,
  nationalNom,
}: Props) {
  const payload = await getPayload({ config })

  const { docs } = await payload.find({
    collection: 'reseaux',
    where: {
      and: [
        // Siblings = même national parent
        { parent: { equals: nationalId } },
        // Publiés uniquement
        { statut: { equals: 'publiee' } },
        // Exclure le réseau courant
        { id: { not_equals: excludeId } },
      ],
    },
    depth: 0,
    sort: 'nom',
    limit: 8,
    overrideAccess: true,
    select: { id: true, slug: true, nom: true, ville: true } as Record<string, boolean>,
  })

  if (docs.length === 0) return null

  const siblings = docs as ReseauSiblingLite[]

  return (
    <section
      aria-labelledby="maillage-national-titre"
      className="px-6 py-5 border-t border-[#e4e4e7]"
    >
      <div className="flex items-center justify-between mb-3">
        <h2
          id="maillage-national-titre"
          className="text-xs font-semibold text-[#71717a] uppercase tracking-wide flex items-center gap-1.5"
        >
          <Network size={12} aria-hidden />
          Autres chapitres {nationalNom}
        </h2>
        {nationalSlug && (
          <Link
            href={`/reseau/${nationalSlug}`}
            className="text-xs text-[#2563EB] hover:text-[#1d4ed8] no-underline font-medium transition-colors"
          >
            Voir {nationalNom}
          </Link>
        )}
      </div>
      <ul className="space-y-1.5" role="list">
        {siblings.map((r) => (
          <li key={r.id}>
            <Link
              href={`/reseau/${r.slug}`}
              className="flex items-center gap-2 text-sm text-[#52525b] hover:text-[#2563EB] no-underline transition-colors group"
            >
              <ArrowRight
                size={12}
                className="text-[#a1a1aa] group-hover:text-[#2563EB] shrink-0 transition-colors"
                aria-hidden
              />
              <span className="font-medium">{r.nom}</span>
              {r.ville && (
                <span className="text-[#a1a1aa] text-xs ml-auto shrink-0">{r.ville}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
