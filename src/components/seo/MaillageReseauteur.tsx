/**
 * MaillageReseauteur — maillage interne sur la fiche réseauteur.
 * Server Component : fetch direct depuis Payload (SSR, pas de client waterfall).
 *
 * Renvoie deux blocs optionnels :
 *   1. Réseauteurs à proximité (même ville)
 *   2. Réseauteurs du même secteur d'activité
 *
 * RGPD : n'affiche que des profils validés (statut = 'valide').
 * Vide → null (pas de section vide affichée).
 */
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'

interface Props {
  /** Ville du réseauteur courant (pour "à proximité"). */
  villeActuelle: string | null | undefined
  /** ID de secteur (pour "même secteur"). */
  secteurId: number | string | null | undefined
  /** ID du réseauteur courant (pour l'exclure des résultats). */
  excludeId: number | string
}

type ReseauteurLite = {
  id: number | string
  slug?: string | null
  prenom: string
  nom: string
  fonction?: string | null
  ville?: string | null
}

export async function MaillageReseauteur({ villeActuelle, secteurId, excludeId }: Props) {
  const payload = await getPayload({ config })

  const [vRes, sRes] = await Promise.all([
    // Réseauteurs même ville (max 5, excl. current)
    villeActuelle
      ? payload.find({
          collection: 'reseauteurs',
          where: {
            and: [
              { statut: { equals: 'valide' } },
              { ville: { equals: villeActuelle } },
              { id: { not_equals: excludeId } },
            ],
          },
          depth: 0,
          limit: 5,
          overrideAccess: true,
          select: { slug: true, prenom: true, nom: true, fonction: true, ville: true } as Record<
            string,
            boolean
          >,
        })
      : Promise.resolve(null),

    // Réseauteurs même secteur (max 5, excl. current)
    secteurId
      ? payload.find({
          collection: 'reseauteurs',
          where: {
            and: [
              { statut: { equals: 'valide' } },
              { secteur: { equals: secteurId } },
              { id: { not_equals: excludeId } },
            ],
          },
          depth: 0,
          limit: 5,
          overrideAccess: true,
          select: { slug: true, prenom: true, nom: true, fonction: true, ville: true } as Record<
            string,
            boolean
          >,
        })
      : Promise.resolve(null),
  ])

  const villeList = (vRes?.docs ?? []) as ReseauteurLite[]
  const secteurList = (sRes?.docs ?? []) as ReseauteurLite[]

  if (villeList.length === 0 && secteurList.length === 0) return null

  return (
    <div className="px-6 py-5 border-t border-[#e4e4e7] space-y-5">
      {villeList.length > 0 && (
        <section aria-labelledby="maillage-ville-titre">
          <h2
            id="maillage-ville-titre"
            className="text-xs font-semibold text-[#71717a] uppercase tracking-wide mb-2.5"
          >
            Réseauteurs à {villeActuelle}
          </h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5" role="list">
            {villeList.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/reseauteur/${r.slug}`}
                  className="text-sm text-[#2563EB] hover:text-[#1d4ed8] no-underline font-medium transition-colors"
                >
                  {r.prenom} {r.nom}
                  {r.fonction && (
                    <span className="text-[#a1a1aa] font-normal"> — {r.fonction}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {secteurList.length > 0 && (
        <section aria-labelledby="maillage-secteur-titre">
          <h2
            id="maillage-secteur-titre"
            className="text-xs font-semibold text-[#71717a] uppercase tracking-wide mb-2.5"
          >
            Même secteur d&apos;activité
          </h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5" role="list">
            {secteurList.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/reseauteur/${r.slug}`}
                  className="text-sm text-[#2563EB] hover:text-[#1d4ed8] no-underline font-medium transition-colors"
                >
                  {r.prenom} {r.nom}
                  {r.ville && (
                    <span className="text-[#a1a1aa] font-normal"> — {r.ville}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
