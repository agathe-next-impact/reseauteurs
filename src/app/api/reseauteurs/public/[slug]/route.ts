/**
 * GET /api/reseauteurs/public/:slug
 *
 * Endpoint public pour la preview et la fiche détail d'un réseauteur.
 * Utilisé par le SlideOverReseauteur et la fiche publique /reseauteur/:slug.
 *
 * Retourne uniquement les champs nécessaires à l'affichage public —
 * les champs facultatifs (téléphone, emailContact) ne sont inclus
 * que si le réseauteur les a renseignés (contrôle de confidentialité ADR-0011 §7).
 */

import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const revalidate = 300

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  if (!slug) {
    return NextResponse.json({ error: 'Slug manquant' }, { status: 400 })
  }

  const payload = await getPayload({ config })

  let doc: Record<string, unknown> | null = null
  try {
    if (/^\d+$/.test(slug)) {
      // Rétrocompat : accepte un ID numérique
      const found = await payload.findByID({
        collection: 'reseauteurs',
        id: slug,
        depth: 2,
        overrideAccess: true,
      })
      doc = found as unknown as Record<string, unknown>
    } else {
      const { docs } = await payload.find({
        collection: 'reseauteurs',
        where: { slug: { equals: slug } },
        depth: 2,
        limit: 1,
        overrideAccess: true,
      })
      doc = (docs[0] ?? null) as unknown as Record<string, unknown>
    }
  } catch {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  }

  if (!doc || doc['statut'] !== 'valide') {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  }

  // ── Types inline pour les relations populées ──────────────────────
  type MediaLite = {
    id: number | string
    url?: string | null
    alt?: string | null
    sizes?: Record<string, { url?: string | null } | undefined>
  }
  type ReseauLite = {
    id: number | string
    slug?: string | null
    nom?: string | null
    logo?: MediaLite | null
  }
  type CatLite = {
    id: number | string
    label?: string | null
    value?: string | null
    couleur?: string | null
  }

  const pickMedia = (m: unknown): MediaLite | null =>
    m && typeof m === 'object' ? (m as MediaLite) : null

  const photo = pickMedia(doc['photo'])
  const secteur = doc['secteur'] as CatLite | null | undefined
  const reseauxFrequentes = (doc['reseauxFrequentes'] as ReseauLite[] | undefined ?? [])
    .filter((r): r is ReseauLite => typeof r === 'object' && r !== null)

  const sanitized = {
    id: doc['id'],
    slug: (doc['slug'] as string | null | undefined) ?? null,
    prenom: (doc['prenom'] as string | undefined) ?? '',
    nom: (doc['nom'] as string | undefined) ?? '',
    fonction: (doc['fonction'] as string | null | undefined) ?? null,
    entreprise: (doc['entreprise'] as string | null | undefined) ?? null,
    description: (doc['description'] as string | null | undefined) ?? null,
    ville: (doc['ville'] as string | undefined) ?? '',
    departement: (doc['departement'] as string | null | undefined) ?? null,
    region: (doc['region'] as string | null | undefined) ?? null,
    badge: (doc['badge'] as string | null | undefined) ?? null,
    // Contacts facultatifs : inclus seulement si renseignés par le réseauteur
    telephone: (doc['telephone'] as string | null | undefined) ?? null,
    emailContact: (doc['emailContact'] as string | null | undefined) ?? null,
    site: (doc['site'] as string | null | undefined) ?? null,
    linkedin: (doc['linkedin'] as string | null | undefined) ?? null,
    // Photo
    photo: photo
      ? {
          url: photo.url ?? null,
          thumbnailUrl:
            photo.sizes?.['thumbnail']?.url ??
            photo.sizes?.['card']?.url ??
            photo.url ??
            null,
          alt: photo.alt ?? null,
        }
      : null,
    // Secteur d'activité
    secteur: secteur
      ? {
          id: secteur.id,
          label: secteur.label ?? null,
          value: secteur.value ?? null,
          couleur: secteur.couleur ?? null,
        }
      : null,
    // Réseaux fréquentés
    reseauxFrequentes: reseauxFrequentes.map((r) => ({
      id: r.id,
      slug: r.slug ?? null,
      nom: r.nom ?? null,
      logoUrl:
        pickMedia(r.logo)?.sizes?.['thumbnail']?.url ??
        pickMedia(r.logo)?.url ??
        null,
    })),
    // Compétences
    competences: ((doc['competences'] as Array<{ label: string }> | undefined) ?? []).map(
      (c) => c.label,
    ),
  }

  return NextResponse.json(sanitized, {
    headers: {
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=60',
    },
  })
}
