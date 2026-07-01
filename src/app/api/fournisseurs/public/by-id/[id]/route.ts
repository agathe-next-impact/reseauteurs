import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * GET /api/fournisseurs/public/by-id/:id
 *
 * Endpoint minimal utilise par la page /inscription?claim=X pour afficher
 * les infos de la fiche a revendiquer (nom, ville, slug, statut orphelin).
 *
 * Ne renvoie QUE les champs publics strictement necessaires au flow claim.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const numericId = Number(id)
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
  }

  const payload = await getPayload({ config })
  const doc = await payload
    .findByID({
      collection: 'fournisseurs',
      id: numericId,
      overrideAccess: true,
      depth: 0,
    })
    .catch(() => null)

  if (!doc || doc.statut !== 'publiee') {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  }

  return NextResponse.json(
    {
      id: doc.id,
      slug: doc.slug,
      raisonSociale: doc.raisonSociale,
      ville: doc.ville,
      isOrphan: !doc.user,
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=60',
      },
    },
  )
}
