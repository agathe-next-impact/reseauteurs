// @ts-nocheck — types en attente de generate:types (data-architect + map-engineer)
/**
 * GET /api/geo/reseauteurs
 *
 * Endpoint géospatial pour la carte des réseauteurs (ADR-0002, ADR-0011).
 * Retourne un GeoJSON FeatureCollection des réseauteurs validés.
 *
 * Paramètres :
 *   Bbox (viewport) : sw_lng, sw_lat, ne_lng, ne_lat
 *   Rayon           : lat, lng, rayon (km) — utilisé pour "autour de moi"
 *   Filtres métier  : secteur (value/slug), reseau (slug), badge, ville
 *
 * Confidentialité : les coordonnées sont au niveau ville/commune (centroïde),
 * jamais l'adresse personnelle exacte (ADR-0011 §7).
 *
 * Index utilisés :
 *   - Bbox  → geom && ST_MakeEnvelope(...)::geography — index GiST sur reseauteurs.geom
 *   - Rayon → ST_DWithin(geom, center::geography, rayon_m) — index GiST (ADR-0002)
 *   - Filtres non-spatiaux → index B-tree sur statut, badge, ville, secteur (Payload find())
 *
 * Sécurité : SQL paramétré uniquement (Drizzle execute + Payload find()).
 */

import { NextResponse } from 'next/server'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import { sql } from '@payloadcms/db-postgres'
import { z } from 'zod/v4'
import { toFeature, toFeatureCollection } from '@/lib/geojson'

export const revalidate = 300

const MAX_RESULTS = 3000

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
  secteur: z.string().max(100).optional(),  // value (slug) de la catégorie
  reseau: z.string().max(500).optional(),   // slug(s) séparés par virgule
  badge: z.enum(['bronze', 'argent', 'gold', 'platinum']).optional(),
  ville: z.string().max(100).optional(),
})

/**
 * Exécute une requête SQL paramétrée via le driver Drizzle sous-jacent.
 * Retourne les lignes résultantes. Paramètres positionnels ($1, $2, …).
 *
 * PostGIS — index GiST :
 *   ST_MakeEnvelope($1, $2, $3, $4, 4326)  → bbox rectangulaire viewport
 *   ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography, $3) → rayon circulaire
 * Dans les deux cas, PostgreSQL utilise l'index GiST sur reseauteurs.geom
 * (geography(Point,4326)) pour accélérer la recherche spatiale.
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
    secteur: searchParams.get('secteur') ?? undefined,
    reseau: searchParams.get('reseau') ?? undefined,
    badge: searchParams.get('badge') ?? undefined,
    ville: searchParams.get('ville') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Paramètres de requête invalides', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const { sw_lng, sw_lat, ne_lng, ne_lat, lat, lng, rayon, secteur, reseau, badge, ville } =
    parsed.data
  const payload = await getPayload({ config })
  const drizzle = payload.db.drizzle as unknown as DrizzleExecutor

  // ── Filtre spatial PostGIS (bbox ou rayon) ─────────────────────────
  // On lance d'abord la requête PostGIS pour récupérer les IDs dans l'emprise.
  // L'index GiST sur reseauteurs.geom (geography(Point,4326)) est utilisé dans
  // les deux cas. Sans filtre spatial, on laisse Payload gérer la pagination.
  const hasBbox =
    sw_lng !== undefined && sw_lat !== undefined && ne_lng !== undefined && ne_lat !== undefined
  const hasRadius = lat !== undefined && lng !== undefined && rayon !== undefined

  let spatialIds: Array<number | string> | null = null

  if (hasBbox) {
    /**
     * Bbox via opérateur && + ST_MakeEnvelope.
     * PostgreSQL planificateur : "Bitmap Heap Scan using reseauteurs_geom_gist_idx"
     * ST_MakeEnvelope(sw_lng, sw_lat, ne_lng, ne_lat, 4326)::geography
     */
    const result = await drizzle.execute(sql`
      SELECT id
         FROM reseauteurs
        WHERE geom IS NOT NULL
          AND statut = 'valide'
          AND geom && ST_MakeEnvelope(${sw_lng}, ${sw_lat}, ${ne_lng}, ${ne_lat}, 4326)::geography
    `.inlineParams())
    spatialIds = result.rows.map((r) => r.id as number | string)
  } else if (hasRadius) {
    /**
     * Rayon circulaire via ST_DWithin — distance en mètres (geography).
     * PostgreSQL planificateur : "Index Scan using reseauteurs_geom_gist_idx"
     * ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography = centre de recherche
     * rayon * 1000 = rayon en mètres (paramètre en km dans l'URL)
     */
    const result = await drizzle.execute(sql`
      SELECT id
         FROM reseauteurs
        WHERE geom IS NOT NULL
          AND statut = 'valide'
          AND ST_DWithin(
                geom,
                ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
                ${rayon * 1000}
              )
    `.inlineParams())
    spatialIds = result.rows.map((r) => r.id as number | string)
  }

  // Si un filtre spatial est actif mais retourne 0 résultat → réponse vide immédiate
  if (spatialIds !== null && spatialIds.length === 0) {
    return NextResponse.json(toFeatureCollection([]), {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
    })
  }

  // ── Conditions de base Payload ──────────────────────────────────────
  const conditions: Where[] = [
    { statut: { equals: 'valide' } },
    // Garde-fou : n'inclut que les réseauteurs geocodés
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

  // ── Filtre badge ────────────────────────────────────────────────────
  if (badge) {
    conditions.push({ badge: { equals: badge } } as Where)
  }

  // ── Filtre secteur : résolution slug → ID ───────────────────────────
  if (secteur) {
    const { docs: cats } = await payload.find({
      collection: 'categories',
      where: { value: { equals: secteur } },
      limit: 1,
      overrideAccess: true,
    })
    const catId = cats[0]?.id
    if (!catId) {
      return NextResponse.json(toFeatureCollection([]), {
        headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
      })
    }
    conditions.push({ secteur: { equals: catId } } as Where)
  }

  // ── Filtre réseau : résolution slug(s) → IDs ────────────────────────
  if (reseau) {
    const slugs = reseau
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const { docs: reseaux } = await payload.find({
      collection: 'reseaux',
      where: { slug: { in: slugs } },
      limit: 20,
      overrideAccess: true,
    })
    const reseauIds = reseaux.map((r) => r.id)
    if (reseauIds.length === 0) {
      return NextResponse.json(toFeatureCollection([]), {
        headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
      })
    }
    conditions.push({
      or: reseauIds.map((id) => ({ reseauxFrequentes: { contains: id } })),
    } as Where)
  }

  // ── Requête principale ──────────────────────────────────────────────
  const where: Where = { and: conditions }

  const { docs } = await payload.find({
    collection: 'reseauteurs',
    where,
    depth: 1, // populate photo (url thumbnail) + secteur (label, couleur)
    limit: MAX_RESULTS,
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
      photo: true,
      secteur: true,
    } as Record<string, boolean>,
  })

  // ── Mapping vers GeoJSON ────────────────────────────────────────────
  type MediaLite = {
    url?: string | null
    sizes?: Record<string, { url?: string | null } | undefined>
  }
  type CatLite = { label?: string | null; couleur?: string | null }

  const features = docs
    .filter((doc) => doc.latitude != null && doc.longitude != null)
    .map((doc) => {
      const photo = doc.photo as MediaLite | null | undefined
      const photoUrl = photo?.sizes?.['thumbnail']?.url ?? photo?.url ?? null
      const secteurDoc = doc.secteur as CatLite | null | undefined

      return toFeature(doc.longitude as number, doc.latitude as number, {
        slug: doc.slug ?? null,
        prenom: (doc.prenom as string | null | undefined) ?? null,
        nom: (doc.nom as string | null | undefined) ?? null,
        entreprise: (doc.entreprise as string | null | undefined) ?? null,
        ville: (doc.ville as string | null | undefined) ?? null,
        badge: (doc.badge as string | null | undefined) ?? null,
        photoUrl,
        secteurLabel: secteurDoc?.label ?? null,
        secteurCouleur: secteurDoc?.couleur ?? null,
      })
    })

  return NextResponse.json(toFeatureCollection(features), {
    headers: {
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=60',
    },
  })
}
