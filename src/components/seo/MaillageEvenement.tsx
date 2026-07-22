/**
 * MaillageEvenement — maillage interne sur la fiche événement.
 * Server Component : fetch direct depuis Payload (SSR).
 *
 * Affiche les prochains événements du même réseau organisateur.
 * Renforce le jus SEO et guide l'utilisateur vers d'autres événements.
 * Vide → null (pas de section affichée).
 */
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CalendarDays, ArrowRight } from 'lucide-react'

interface Props {
  /** ID du réseau organisateur (pour trouver ses autres événements). */
  reseauId: number | string | null | undefined
  /** ID de l'événement courant (pour l'exclure). */
  excludeId: number | string
  /** Slug du réseau (pour le lien "voir tous les événements"). */
  reseauSlug?: string | null
  /** Nom du réseau (pour le titre de section). */
  reseauNom?: string | null
}

type EvenementLite = {
  id: number | string
  slug?: string | null
  titre: string
  dateDebut: string
  lieuVille?: string | null
}

export async function MaillageEvenement({ reseauId, excludeId, reseauSlug, reseauNom }: Props) {
  if (!reseauId) return null

  const payload = await getPayload({ config })

  const { docs } = await payload.find({
    collection: 'evenements',
    where: {
      and: [
        { statut: { equals: 'publie' } },
        { reseau: { equals: reseauId } },
        { id: { not_equals: excludeId } },
        { dateDebut: { greater_than_equal: new Date().toISOString() } },
      ],
    },
    depth: 0,
    sort: 'dateDebut',
    limit: 4,
    overrideAccess: true,
    select: { slug: true, titre: true, dateDebut: true, lieuVille: true } as Record<
      string,
      boolean
    >,
  })

  if (docs.length === 0) return null

  const evenements = docs as EvenementLite[]
  const sectionTitle = reseauNom
    ? `Autres événements ${reseauNom}`
    : 'Autres événements de ce réseau'

  return (
    <section
      aria-labelledby="maillage-evenements-titre"
      className="px-6 py-5 border-t border-[#DFE0E1]"
    >
      <div className="flex items-center justify-between mb-3">
        <h2
          id="maillage-evenements-titre"
          className="text-xs font-semibold text-[#6E7175] uppercase tracking-wide flex items-center gap-1.5"
        >
          <CalendarDays size={12} aria-hidden />
          {sectionTitle}
        </h2>
        {reseauSlug && (
          <Link
            href={`/evenements?reseau=${reseauSlug}`}
            className="text-xs text-[#035AA6] hover:text-[#02467F] no-underline font-medium transition-colors"
          >
            Tous les événements
          </Link>
        )}
      </div>
      <ul className="space-y-1.5" role="list">
        {evenements.map((ev) => (
          <li key={ev.id}>
            <Link
              href={`/evenement/${ev.slug}`}
              className="flex items-center gap-2 text-sm text-[#4E5155] hover:text-[#035AA6] no-underline transition-colors group"
            >
              <ArrowRight
                size={12}
                className="text-[#999A9D] group-hover:text-[#035AA6] shrink-0 transition-colors"
                aria-hidden
              />
              <span className="font-medium">{ev.titre}</span>
              <span className="text-[#999A9D] text-xs ml-auto shrink-0">
                {new Date(ev.dateDebut).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                })}
                {ev.lieuVille && ` · ${ev.lieuVille}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
