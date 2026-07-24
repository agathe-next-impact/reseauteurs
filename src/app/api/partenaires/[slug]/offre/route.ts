/**
 * GET /api/partenaires/[slug]/offre — contenu de l'offre partenaire.
 *
 * Per-user (non caché) : permet à la fiche partenaire de rester ISR/statique tout en
 * personnalisant l'affichage de l'offre selon le viewer. Le CONTENU public de l'offre
 * (titre + description) est renvoyé à TOUT LE MONDE (teaser incitant à l'inscription),
 * mais le LIEN de redemption (« En profiter ») n'est renvoyé qu'aux réseauteurs/admin
 * (`canActivate`) : l'offre est visible mais non activable sans compte réseauteur.
 */
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'

function safeUrl(v: unknown): string | null {
  if (!v || typeof v !== 'string') return null
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:' ? v : null
  } catch {
    return null
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const payload = await getPayload({ config })

  const { docs } = await payload.find({
    collection: 'partenaires',
    where: { and: [{ slug: { equals: slug } }, { statut: { equals: 'actif' } }] },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const p = docs[0] as { offre?: { titre?: string | null; description?: string | null; lien?: string | null } } | undefined
  const offre = p?.offre ?? null
  const hasOffre = !!(offre?.titre && offre.titre.trim())

  if (!hasOffre) return NextResponse.json({ hasOffre: false, canActivate: false })

  const hdrs = await headers()
  const { user } = await payload.auth({ headers: hdrs })
  // canActivate = droit d'ACTIVER l'offre (récupérer le lien « En profiter »). Le teaser
  // (titre + description) reste public ; seul le lien de redemption est réservé.
  const canActivate = user?.role === 'reseauteur' || user?.role === 'admin'

  return NextResponse.json({
    hasOffre: true,
    canActivate,
    offre: {
      titre: offre!.titre,
      description: offre!.description ?? null,
      lien: canActivate ? safeUrl(offre!.lien) : null,
    },
  })
}
