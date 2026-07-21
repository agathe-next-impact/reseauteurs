/**
 * GET /api/geo/reseaux
 *
 * Endpoint géospatial pour la carte des réseaux locaux (ADR-0002, ADR-0012).
 * Retourne un GeoJSON FeatureCollection des réseaux locaux publiés et géolocalisés.
 *
 * RÈGLE FONDAMENTALE (ADR-0012) : seuls les réseaux niveau='local' sont des marqueurs.
 * Les réseaux nationaux ne sont JAMAIS cartographiés (pas de point unique par nature).
 *
 * Paramètres :
 *   Bbox       : sw_lng, sw_lat, ne_lng, ne_lat
 *   Rayon      : lat, lng, rayon (km) — "autour de moi"
 *   Filtres    : national (ID du parent national), categorie (value/slug TypesEvenement), ville
 *
 * Propriétés de chaque Feature GeoJSON :
 *   id, slug, nom, ville, logoUrl,
 *   parentNational : { id, nom, slug } | null,
 *   nbReseauteurs, nbEvenements
 *
 * Index utilisés :
 *   - Bbox  → geom && ST_MakeEnvelope(...)::geography — index GiST sur reseaux.geom
 *   - Rayon → ST_DWithin(geom, center::geography, rayon_m) — index GiST (ADR-0002)
 *   - Filtres non-spatiaux → index B-tree sur statut, niveau, ville, parent (Payload find())
 *
 * Sécurité : SQL paramétré uniquement — Zod + Drizzle execute(). Aucune interpolation brute.
 */

import { NextResponse } from 'next/server'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import { sql } from '@payloadcms/db-postgres'
import { z } from 'zod/v4'
import { toFeature, toFeatureCollection } from '@/lib/geojson'

export const revalidate = 300

const MAX_RESULTS = 2000

/** Schéma Zod — validation stricte des paramètres */
const querySchema = z.object({
  // Bounding box (viewport carte)
  sw_lng: z.coerce.number().min(-25).max(30).optional(),
  sw_lat: z.coerce.number().min(35).max(75).optional(),
  ne_lng: z.coerce.number().min(-25).max(30).optional(),
  ne_lat: z.coerce.number().min(35).max(75).optional(),
  // Rayon "autour de moi" (centre + distance)
  lat: z.coerce.number().min(35).max(75).optional(),
  lng: z.coerce.number().min(-25).max(30).optional(),
  rayon: z.coerce.number().min(1).max(300).optional(), // km
  // Filtres métier
  national: z.coerce.number().int().positive().optional(), // ID du réseau national parent
  categorie: z.string().max(100).optional(),               // value/slug TypesEvenement (categorie de réseau)
  ville: z.string().max(100).optional(),
})

/**
 * Exécute une requête SQL paramétrée via le driver Drizzle sous-jacent.
 * PostGIS — index GiST sur reseaux.geom (geography(Point,4326)) :
 *   Bbox  : geom && ST_MakeEnvelope(sw_lng, sw_lat, ne_lng, ne_lat, 4326)::geography
 *   Rayon : ST_DWithin(geom, ST_SetSRID(ST_MakePoint(lng,lat),4326)::geography, rayon_m)
 */
type DrizzleExecutor = {
  execute: (query: unknown) => Promise<{ rows: Array<Record<string, unknown>> }>
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const parsed = querySchema.safeParse({
    sw_lng: searchParams.get('sw_lng') ?? undefined,
    sw_lat: searchParams.get('sw_lat') ?? undefined,
    ne_lng: searchParams.get('ne_lng') ?? undefined,
    ne_lat: searchParams.get('ne_lat') ?? undefined,
    lat: searchParams.get('lat') ?? undefined,
    lng: searchParams.get('lng') ?? undefined,
    rayon: searchParams.get('rayon') ?? undefined,
    national: searchParams.get('national') ?? undefined,
    categorie: searchParams.get('categorie') ?? undefined,
    ville: searchParams.get('ville') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Paramètres de requête invalides', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const { sw_lng, sw_lat, ne_lng, ne_lat, lat, lng, rayon, national, categorie, ville } =
    parsed.data
  const payload = await getPayload({ config })
  const drizzle = payload.db.drizzle as unknown as DrizzleExecutor

  // ── Filtre spatial PostGIS (bbox ou rayon) ─────────────────────────
  // L'index GiST sur reseaux.geom (geography(Point,4326)) est utilisé dans
  // les deux cas. Le filtre niveau='local' est inclus dans la requête SQL
  // pour cohérence avec les conditions Payload qui suivent.
  const hasBbox =
    sw_lng !== undefined && sw_lat !== undefined && ne_lng !== undefined && ne_lat !== undefined
  const hasRadius = lat !== undefined && lng !== undefined && rayon !== undefined

  let spatialIds: Array<number | string> | null = null

  if (hasBbox) {
    /**
     * Bbox via opérateur && + ST_MakeEnvelope.
     * PostgreSQL planificateur : "Bitmap Heap Scan using reseaux_geom_gist_idx"
     * ST_MakeEnvelope(sw_lng, sw_lat, ne_lng, ne_lat, 4326)::geography
     */
    const result = await drizzle.execute(sql`
      SELECT id
         FROM reseaux
        WHERE geom IS NOT NULL
          AND statut = 'publiee'
          AND niveau = 'local'
          AND geom && ST_MakeEnvelope(${sw_lng}, ${sw_lat}, ${ne_lng}, ${ne_lat}, 4326)::geography
    `.inlineParams())
    spatialIds = result.rows.map((r) => r.id as number | string)
  } else if (hasRadius) {
    /**
     * Rayon circulaire via ST_DWithin — distance en mètres (geography).
     * PostgreSQL planificateur : "Index Scan using reseaux_geom_gist_idx"
     * ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography = centre de recherche
     * rayon * 1000 = conversion km → mètres
     */
    const result = await drizzle.execute(sql`
      SELECT id
         FROM reseaux
        WHERE geom IS NOT NULL
          AND statut = 'publiee'
          AND niveau = 'local'
          AND ST_DWithin(
                geom,
                ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
                ${rayon * 1000}
              )
    `.inlineParams())
    spatialIds = result.rows.map((r) => r.id as number | string)
  }

  // Filtre spatial actif mais résultat vide → réponse immédiate
  if (spatialIds !== null && spatialIds.length === 0) {
    return NextResponse.json(toFeatureCollection([]), {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
    })
  }

  // ── Conditions de base Payload ──────────────────────────────────────
  // INVARIANT ADR-0012 : seuls les niveau='local' sont cartographiés.
  const conditions: Where[] = [
    { statut: { equals: 'publiee' } },
    { niveau: { equals: 'local' } },
    // Garde-fou : n'inclut que les réseaux géocodés
    { latitude: { exists: true } },
    { longitude: { exists: true } },
  ]

  // Filtre spatial → contrainte sur les IDs retournés par PostGIS
  if (spatialIds !== null) {
    conditions.push({ id: { in: spatialIds } } as Where)
  }

  // ── Filtre ville ────────────────────────────────────────────────────
  if (ville) {
    conditions.push({ ville: { like: `${ville.trim()}%` } } as Where)
  }

  // ── Filtre national (parent) ────────────────────────────────────────
  if (national !== undefined) {
    conditions.push({ parent: { equals: national } } as Where)
  }

  // ── Filtre catégorie : résolution slug → ID ─────────────────────────
  // La catégorie d'un réseau relate à la collection 'types-evenement' (TypesEvenement).
  if (categorie) {
    const { docs: types } = await payload.find({
      collection: 'types-evenement',
      where: { value: { equals: categorie } },
      limit: 1,
      overrideAccess: true,
    })
    const typeId = types[0]?.id
    if (!typeId) {
      // Catégorie inconnue → aucun résultat dans cette catégorie
      return NextResponse.json(toFeatureCollection([]), {
        headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
      })
    }
    conditions.push({ categorie: { equals: typeId } } as Where)
  }

  // ── Requête principale ──────────────────────────────────────────────
  const where: Where = { and: conditions }

  const { docs } = await payload.find({
    collection: 'reseaux',
    where,
    depth: 1, // populate logo (Media) + parent (Reseau : id, nom, slug)
    limit: MAX_RESULTS,
    overrideAccess: true,
    select: {
      slug: true,
      nom: true,
      ville: true,
      latitude: true,
      longitude: true,
      logo: true,
      parent: true,
      nbReseauteurs: true,
      nbEvenements: true,
    } as Record<string, boolean>,
  })

  // ── Mapping vers GeoJSON ────────────────────────────────────────────
  type MediaLite = {
    url?: string | null
    sizes?: Record<string, { url?: string | null } | undefined>
  }
  type ParentLite = {
    id: number | string
    nom?: string | null
    slug?: string | null
  }

  const features = docs
    .filter((doc) => doc.latitude != null && doc.longitude != null)
    .map((doc) => {
      const logo = doc.logo as MediaLite | null | undefined
      const logoUrl =
        logo?.sizes?.['thumbnail']?.url ?? logo?.sizes?.['card']?.url ?? logo?.url ?? null

      const parent = doc.parent as ParentLite | string | number | null | undefined
      const parentNational =
        parent && typeof parent === 'object' && 'id' in parent
          ? {
              id: (parent as ParentLite).id,
              nom: (parent as ParentLite).nom ?? null,
              slug: (parent as ParentLite).slug ?? null,
            }
          : null

      return toFeature(doc.longitude as number, doc.latitude as number, {
        id: doc.id,
        slug: (doc.slug as string | null | undefined) ?? null,
        nom: (doc.nom as string | null | undefined) ?? null,
        ville: (doc.ville as string | null | undefined) ?? null,
        logoUrl,
        parentNational,
        nbReseauteurs: (doc.nbReseauteurs as number | null | undefined) ?? 0,
        nbEvenements: (doc.nbEvenements as number | null | undefined) ?? 0,
      })
    })

  return NextResponse.json(toFeatureCollection(features), {
    headers: {
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=60',
    },
  })
}
