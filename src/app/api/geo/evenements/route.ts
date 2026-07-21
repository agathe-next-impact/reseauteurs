/**
 * GET /api/geo/evenements
 *
 * Endpoint géospatial pour la carte des événements (ADR-0002, ADR-0011, ADR-0012).
 * Retourne un GeoJSON FeatureCollection des événements publiés à venir.
 *
 * ADR-0012 : l'événement Premium ponctuel est supprimé. Un seul type de marqueur.
 *
 * Paramètres :
 *   Bbox       : sw_lng, sw_lat, ne_lng, ne_lat
 *   Rayon      : lat, lng, rayon (km)
 *   Filtres    : reseau (slug), ville, dateDebut (ISO), dateFin (ISO)
 *
 * Index utilisés :
 *   - Bbox  → geom && ST_MakeEnvelope(...)::geography — index GiST sur evenements.geom
 *   - Rayon → ST_DWithin(geom, center::geography, rayon_m) — index GiST (ADR-0002)
 *   - Filtres non-spatiaux → index B-tree sur statut, dateDebut, lieuVille, reseau (Payload find())
 *
 * Sécurité : SQL paramétré uniquement — Payload find() + Drizzle execute() PostGIS.
 */

import { NextResponse } from 'next/server'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import { sql } from '@payloadcms/db-postgres'
import { z } from 'zod/v4'
import { toFeature, toFeatureCollection } from '@/lib/geojson'
import { todayParisDateString } from '@/lib/dates'

export const revalidate = 300

const MAX_RESULTS = 5000

const querySchema = z.object({
  // Bounding box
  sw_lng: z.coerce.number().min(-25).max(30).optional(),
  sw_lat: z.coerce.number().min(35).max(75).optional(),
  ne_lng: z.coerce.number().min(-25).max(30).optional(),
  ne_lat: z.coerce.number().min(35).max(75).optional(),
  // Rayon
  lat: z.coerce.number().min(35).max(75).optional(),
  lng: z.coerce.number().min(-25).max(30).optional(),
  rayon: z.coerce.number().min(1).max(300).optional(),
  // Filtres
  reseau: z.string().max(500).optional(),    // slug(s) séparés par virgule
  ville: z.string().max(100).optional(),
  dateDebut: z.string().max(30).optional(),  // ISO date
  dateFin: z.string().max(30).optional(),    // ISO date
})

/**
 * Exécute une requête SQL paramétrée via le driver Drizzle sous-jacent.
 * PostGIS — index GiST sur evenements.geom (geography(Point,4326)) :
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
    reseau: searchParams.get('reseau') ?? undefined,
    ville: searchParams.get('ville') ?? undefined,
    dateDebut: searchParams.get('dateDebut') ?? undefined,
    dateFin: searchParams.get('dateFin') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const { sw_lng, sw_lat, ne_lng, ne_lat, lat, lng, rayon, reseau, ville, dateDebut, dateFin } =
    parsed.data
  const payload = await getPayload({ config })
  const drizzle = payload.db.drizzle as unknown as DrizzleExecutor

  // ── Filtre spatial PostGIS (bbox ou rayon) ─────────────────────────
  const hasBbox =
    sw_lng !== undefined && sw_lat !== undefined && ne_lng !== undefined && ne_lat !== undefined
  const hasRadius = lat !== undefined && lng !== undefined && rayon !== undefined

  let spatialIds: Array<number | string> | null = null

  if (hasBbox) {
    /**
     * Bbox via opérateur && + ST_MakeEnvelope — index GiST sur evenements.geom.
     * ST_MakeEnvelope(sw_lng, sw_lat, ne_lng, ne_lat, 4326)::geography
     */
    const result = await drizzle.execute(sql`
      SELECT id
         FROM evenements
        WHERE geom IS NOT NULL
          AND statut = 'publie'
          AND geom && ST_MakeEnvelope(${sw_lng}, ${sw_lat}, ${ne_lng}, ${ne_lat}, 4326)::geography
    `.inlineParams())
    spatialIds = result.rows.map((r) => r.id as number | string)
  } else if (hasRadius) {
    /**
     * Rayon circulaire via ST_DWithin — distance en mètres (geography).
     * ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography = centre de recherche
     * rayon * 1000 = conversion km → mètres
     */
    const result = await drizzle.execute(sql`
      SELECT id
         FROM evenements
        WHERE geom IS NOT NULL
          AND statut = 'publie'
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

  // ── Conditions de base ──────────────────────────────────────────────
  const todayStart = new Date(`${todayParisDateString()}T00:00:00.000Z`)

  const conditions: Where[] = [
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
    } as Where,
  ]

  // Filtre spatial → contrainte sur les IDs retournés par PostGIS
  if (spatialIds !== null) {
    conditions.push({ id: { in: spatialIds } } as Where)
  }

  // ── Filtre ville ────────────────────────────────────────────────────
  if (ville) {
    conditions.push({ lieuVille: { like: `${ville.trim()}%` } } as Where)
  }

  // ── Filtre date de début ────────────────────────────────────────────
  if (dateDebut) {
    const d = new Date(dateDebut)
    if (!Number.isNaN(d.getTime())) {
      const effectiveStart = d > todayStart ? d : todayStart
      conditions.push({ dateDebut: { greater_than_equal: effectiveStart.toISOString() } } as Where)
    }
  }

  // ── Filtre date de fin ──────────────────────────────────────────────
  if (dateFin) {
    const d = new Date(dateFin)
    if (!Number.isNaN(d.getTime())) {
      const endOfDay = new Date(d)
      endOfDay.setUTCHours(23, 59, 59, 999)
      conditions.push({ dateDebut: { less_than_equal: endOfDay.toISOString() } } as Where)
    }
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
      or: reseauIds.map((id) => ({ reseau: { equals: id } })),
    } as Where)
  }

  // ── Requête principale ──────────────────────────────────────────────
  const where: Where = { and: conditions }

  // Payload allégé (vue France = jusqu'à 5000 features) : ni image ni description
  // détaillée — la preview/fiche passe par /api/evenements/public/v2/[slug]. Le réseau
  // organisateur est réduit à nom+slug via `populate` (le doc complet — présentation,
  // fonctionnement… — multipliait le poids du JSON).
  const { docs } = await payload.find({
    collection: 'evenements',
    where,
    depth: 1,
    // Le réseauteur organisateur est réduit au slug : seul le discriminant
    // réseau/réseauteur (couleur du marqueur — ADR-0013) est nécessaire ici.
    populate: { reseaux: { nom: true, slug: true }, reseauteurs: { slug: true } },
    limit: MAX_RESULTS,
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
      organisateurReseauteur: true,
      descriptionCourte: true,
    } as Record<string, boolean>,
  })

  // ── Mapping vers GeoJSON ────────────────────────────────────────────
  // ADR-0012 : un seul type de marqueur événement (plus de variante Premium).
  type ReseauLite = { id: number | string; slug?: string | null; nom?: string | null }

  const features = docs
    .filter((doc) => doc.lieuLatitude != null && doc.lieuLongitude != null)
    .map((doc) => {
      const reseauDoc = doc.reseau as ReseauLite | null | undefined

      return toFeature(doc.lieuLongitude as number, doc.lieuLatitude as number, {
        slug: doc.slug ?? null,
        titre: (doc.titre as string | undefined) ?? null,
        dateDebut: (doc.dateDebut as string | undefined) ?? null,
        dateFin: (doc.dateFin as string | null | undefined) ?? null,
        lieuVille: (doc.lieuVille as string | undefined) ?? null,
        lienInscription: (doc.lienInscription as string | null | undefined) ?? null,
        reseauNom: reseauDoc?.nom ?? null,
        reseauSlug: reseauDoc?.slug ?? null,
        // Discriminant XOR (ADR-0013) : couleur du marqueur réseau vs réseauteur Plus
        organisateur: doc.organisateurReseauteur != null ? 'reseauteur' : 'reseau',
        // Description courte (120 chars max) pour la preview carte
        descriptionCourte: doc.descriptionCourte
          ? String(doc.descriptionCourte).slice(0, 120)
          : null,
      })
    })

  return NextResponse.json(toFeatureCollection(features), {
    headers: {
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=60',
    },
  })
}
