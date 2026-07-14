/**
 * /carte/reseauteurs — Carte des réseauteurs (ADR-0006, ADR-0011).
 *
 * Page SSR : pré-charge les données initiales (vue France entière, zoom 5.5),
 * les catégories et les réseaux pour alimenter les filtres côté client.
 *
 * Géolocalisation : uniquement sur action utilisateur dans le composant client
 * (jamais au chargement — RGPD ADR-0011 §7).
 *
 * URL synchronisée : ?r=<slug> ouvre le panneau du réseauteur correspondant.
 *
 * Lane : map-engineer. Ne pas modifier la home, les fiches, ni le layout.
 */

import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { buildMetadata } from '@/lib/seo'
import { withDbRetry } from '@/lib/db-retry'
import { toFeatureCollection, toFeature } from '@/lib/geojson'
import { SITE_NAME } from '@/lib/site'
import MapReseauteursLoader from '@/components/maps/MapReseauteursLoader'
import type { CategoryLite, ReseauLite } from '@/components/filters/FiltresReseauteurs'

export const revalidate = 120

export const metadata: Metadata = buildMetadata({
  title: `Carte des réseauteurs — Trouvez un professionnel près de chez vous | ${SITE_NAME}`,
  description:
    'Explorez la carte nationale des professionnels du networking : entrepreneurs, dirigeants, indépendants par ville, secteur, réseau et badge.',
  path: '/carte/reseauteurs',
})

interface PageProps {
  searchParams: Promise<{ r?: string }>
}

export default async function CarteReseauteursPage({ searchParams }: PageProps) {
  const { r: initialSlug } = await searchParams
  const payload = await getPayload({ config })

  // Charge en parallèle : données initiales de la carte + catégories + réseaux
  const [{ docs: reseauteursDocs }, { docs: categoriesDocs }, { docs: reseauxDocs }] =
    await Promise.all([
      withDbRetry(
        () =>
          payload.find({
            collection: 'reseauteurs',
            where: {
              and: [
                { statut: { equals: 'valide' } },
                { latitude: { exists: true } },
                { longitude: { exists: true } },
              ],
            },
            depth: 0,
            limit: 1500, // SSR borné — la carte recharge par bbox sur déplacement
            overrideAccess: true,
            select: {
              slug: true,
              prenom: true,
              nom: true,
              entreprise: true,
              ville: true,
              badge: true,
              latitude: true,
              longitude: true,
            } as Record<string, boolean>,
          }),
        { label: 'carte-reseauteurs:find' },
      ),
      withDbRetry(
        () =>
          payload.find({
            collection: 'categories',
            depth: 0,
            limit: 100,
            sort: 'ordre',
            overrideAccess: true,
          }),
        { label: 'carte-reseauteurs:categories' },
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
        { label: 'carte-reseauteurs:reseaux' },
      ),
    ])

  // Construire le GeoJSON initial (vue France)
  const features = reseauteursDocs
    .filter((doc) => doc.latitude != null && doc.longitude != null)
    .map((doc) =>
      toFeature(doc.longitude as number, doc.latitude as number, {
        slug: doc.slug ?? null,
        prenom: (doc.prenom as string | undefined) ?? '',
        nom: (doc.nom as string | undefined) ?? '',
        entreprise: (doc.entreprise as string | null | undefined) ?? null,
        ville: (doc.ville as string | undefined) ?? '',
        badge: (doc.badge as string | null | undefined) ?? null,
      }),
    )
  const initialData = toFeatureCollection(features)

  const categories: CategoryLite[] = categoriesDocs.map((c) => ({
    id: c.id as number,
    value: (c.value as string) ?? '',
    label: (c.label as string) ?? '',
    couleur: (c.couleur as string | null | undefined) ?? null,
  }))

  const reseaux: ReseauLite[] = reseauxDocs.map((r) => ({
    id: r.id as number,
    slug: (r.slug as string) ?? '',
    nom: (r.nom as string) ?? '',
  }))

  return (
    <MapReseauteursLoader
      initialData={initialData}
      initialSlug={initialSlug ?? null}
      categories={categories}
      reseaux={reseaux}
    />
  )
}
