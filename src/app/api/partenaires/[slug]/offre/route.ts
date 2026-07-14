/**
 * GET /api/partenaires/[slug]/offre — contenu de l'offre réservée aux réseauteurs.
 *
 * Per-user (non caché) : permet à la fiche partenaire de rester ISR/statique tout en
 * gardant l'offre RÉSERVÉE aux réseauteurs connectés (RGPD/ciblage B2B). Le contenu de
 * l'offre n'entre jamais dans le HTML statique — il n'est renvoyé qu'aux réseauteurs/admin.
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

  if (!hasOffre) return NextResponse.json({ hasOffre: false, canSee: false })

  const hdrs = await headers()
  const { user } = await payload.auth({ headers: hdrs })
  const canSee = user?.role === 'reseauteur' || user?.role === 'admin'

  if (!canSee) return NextResponse.json({ hasOffre: true, canSee: false })

  return NextResponse.json({
    hasOffre: true,
    canSee: true,
    offre: {
      titre: offre!.titre,
      description: offre!.description ?? null,
      lien: safeUrl(offre!.lien),
    },
  })
}
