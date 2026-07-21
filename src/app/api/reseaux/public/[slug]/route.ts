/**
 * GET /api/reseaux/public/:slug
 *
 * Endpoint public pour la prévisualisation d'un réseau (local ou national).
 * Utilisé par SlideOverReseau (carte des réseaux locaux — ADR-0012).
 *
 * Retourne : id, slug, nom, niveau, ville, description, logoUrl, siteWeb,
 *            partenaire, parent national {id, nom, slug, logoUrl, partenaire},
 *            nbReseauteurs, nbEvenements.
 *
 * Statut payant (partenaire) évalué côté serveur uniquement (invariant ADR-0011/0012).
 * Aucun statut payant n'est jamais déduit du client.
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
    const { docs } = await payload.find({
      collection: 'reseaux',
      where: {
        and: [
          { slug: { equals: slug } },
          { statut: { equals: 'publiee' } },
        ],
      },
      depth: 2, // populate logo + parent (avec son logo)
      limit: 1,
      overrideAccess: true,
    })
    doc = (docs[0] ?? null) as unknown as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  }

  if (!doc) {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  }

  type MediaLite = {
    id: number | string
    url?: string | null
    alt?: string | null
    sizes?: Record<string, { url?: string | null } | undefined>
  }
  type ParentDoc = {
    id: number | string
    slug?: string | null
    nom?: string | null
    partenaire?: boolean | null
    logo?: MediaLite | null
  }

  const pickLogoUrl = (m: unknown): string | null => {
    if (!m || typeof m !== 'object') return null
    const media = m as MediaLite
    return (
      media.sizes?.['thumbnail']?.url ??
      media.sizes?.['card']?.url ??
      media.url ??
      null
    )
  }

  const logo = doc['logo'] as MediaLite | null | undefined
  const rawParent = doc['parent'] as ParentDoc | string | number | null | undefined
  const parentNational =
    rawParent && typeof rawParent === 'object' && 'id' in rawParent
      ? {
          id: (rawParent as ParentDoc).id,
          slug: (rawParent as ParentDoc).slug ?? null,
          nom: (rawParent as ParentDoc).nom ?? null,
          // Statut partenaire du national — évalué côté serveur (webhook Stripe)
          partenaire: (rawParent as ParentDoc).partenaire === true,
          logoUrl: pickLogoUrl((rawParent as ParentDoc).logo),
        }
      : null

  const sanitized = {
    id: doc['id'],
    slug: (doc['slug'] as string | null | undefined) ?? null,
    nom: (doc['nom'] as string) ?? '',
    niveau: (doc['niveau'] as 'local' | 'regional' | 'national' | 'international' | undefined) ?? 'national',
    ville: (doc['ville'] as string) ?? '',
    adresse: (doc['adresse'] as string | null | undefined) ?? null,
    codePostal: (doc['codePostal'] as string | null | undefined) ?? null,
    description: (doc['description'] as string | null | undefined) ?? null,
    logoUrl: pickLogoUrl(logo),
    siteWeb: (doc['siteWeb'] as string | null | undefined) ?? null,
    // Statut partenaire du réseau lui-même (significatif si national, inerte si local)
    partenaire: (doc['partenaire'] as boolean | null | undefined) === true,
    nbReseauteurs: (doc['nbReseauteurs'] as number | null | undefined) ?? 0,
    nbEvenements: (doc['nbEvenements'] as number | null | undefined) ?? 0,
    parentNational,
  }

  return NextResponse.json(sanitized, {
    headers: {
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=60',
    },
  })
}
