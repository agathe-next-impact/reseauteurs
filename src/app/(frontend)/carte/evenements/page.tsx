// @ts-nocheck — types en attente de generate:types (data-architect + map-engineer)
/**
 * /carte/evenements — Carte des événements business (ADR-0006, ADR-0011, ADR-0012).
 *
 * Page SSR : pré-charge les événements à venir + les réseaux pour les filtres.
 *
 * ADR-0012 : l'événement Premium est supprimé. Un seul type de marqueur événement.
 * S'inscrire : lien externe vers le site du réseau — RÉSEAUTEURS n'organise pas (ADR-0011 §1).
 *
 * URL synchronisée : ?e=<slug> ouvre le panneau de l'événement correspondant.
 *
 * Lane : map-engineer.
 */

import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { buildMetadata } from '@/lib/seo'
import { withDbRetry } from '@/lib/db-retry'
import { toFeatureCollection, toFeature } from '@/lib/geojson'
import { todayParisDateString } from '@/lib/dates'
import { SITE_NAME } from '@/lib/site'
import MapEvenementsReseauteursLoader from '@/components/maps/MapEvenementsReseauteursLoader'
import type { ReseauLiteFilter } from '@/components/filters/FiltresEvenementsReseauteurs'

export const revalidate = 120

export const metadata: Metadata = buildMetadata({
  title: `Carte des événements networking — Prochains rendez-vous business | ${SITE_NAME}`,
  description:
    'Trouvez les prochains événements de networking près de chez vous : afterworks, petits-déjeuners, conférences par ville, réseau et date.',
  path: '/carte/evenements',
})

interface PageProps {
  searchParams: Promise<{ e?: string }>
}

export default async function CarteEvenementsPage({ searchParams }: PageProps) {
  const { e: initialSlug } = await searchParams
  const payload = await getPayload({ config })

  const todayStart = new Date(`${todayParisDateString()}T00:00:00.000Z`)

  const [{ docs: evenementsDocs }, { docs: reseauxDocs }] = await Promise.all([
    withDbRetry(
      () =>
        payload.find({
          collection: 'evenements',
          where: {
            and: [
              { statut: { equals: 'publie' } },
              { lieuLatitude: { exists: true } },
              { lieuLongitude: { exists: true } },
              // Seulement les événements à venir ou en cours
              {
                or: [
                  { dateFin: { greater_than_equal: todayStart.toISOString() } },
                  {
                    and: [
                      { dateFin: { exists: false } },
                      { dateDebut: { greater_than_equal: todayStart.toISOString() } },
                    ],
                  },
                ],
              },
            ],
          },
          depth: 1,  // populate reseau
          limit: 800, // amorce SSR (la carte recharge le viewport réel via l'API bbox au 1er idle)
          overrideAccess: true,
          select: {
            slug: true,
            titre: true,
            dateDebut: true,
            dateFin: true,
            lieuVille: true,
            lieuLatitude: true,
            lieuLongitude: true,
            lienInscription: true,
            reseau: true,
          } as Record<string, boolean>,
        }),
      { label: 'carte-evenements:find' },
    ),
    withDbRetry(
      () =>
        payload.find({
          collection: 'reseaux',
          where: { statut: { equals: 'publiee' } },
          depth: 0,
          limit: 200,
          sort: 'nom',
          overrideAccess: true,
          select: { id: true, slug: true, nom: true } as Record<string, boolean>,
        }),
      { label: 'carte-evenements:reseaux' },
    ),
  ])

  type ReseauLiteDoc = { id: number | string; slug?: string | null; nom?: string | null }

  // Mapping GeoJSON — ADR-0012 : un seul type de marqueur (plus de Premium)
  const features = evenementsDocs
    .filter((doc) => doc.lieuLatitude != null && doc.lieuLongitude != null)
    .map((doc) => {
      const reseauDoc = doc.reseau as ReseauLiteDoc | null | undefined
      return toFeature(doc.lieuLongitude as number, doc.lieuLatitude as number, {
        slug: doc.slug ?? null,
        titre: (doc.titre as string | undefined) ?? null,
        dateDebut: (doc.dateDebut as string | undefined) ?? null,
        lieuVille: (doc.lieuVille as string | undefined) ?? null,
        lienInscription: (doc.lienInscription as string | null | undefined) ?? null,
        reseauNom: reseauDoc?.nom ?? null,
        reseauSlug: reseauDoc?.slug ?? null,
      })
    })

  const initialData = toFeatureCollection(features)

  const reseaux: ReseauLiteFilter[] = reseauxDocs.map((r) => ({
    id: r.id as number,
    slug: (r.slug as string) ?? '',
    nom: (r.nom as string) ?? '',
  }))

  return (
    <MapEvenementsReseauteursLoader
      initialData={initialData}
      initialSlug={initialSlug ?? null}
      reseaux={reseaux}
    />
  )
}
