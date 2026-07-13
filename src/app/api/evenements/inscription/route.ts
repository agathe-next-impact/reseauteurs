/**
 * POST /api/evenements/inscription — s'inscrire / se désinscrire d'un événement Plus (ADR-0013 §3bis).
 *
 * Body : { evenementId: number, inscrire: boolean }
 * Auth : réseauteur connecté. Rate-limité. Toutes les règles (événement Plus, publié,
 * à venir, unicité) sont vérifiées serveur — lib/inscriptions.ts.
 */
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod/v4'
import { rateLimit } from '@/lib/rate-limit'
import { inscrire, desinscrire, compterInscrits, estInscrit } from '@/lib/inscriptions'

const bodySchema = z.object({
  evenementId: z.coerce.number().int().positive(),
  inscrire: z.boolean(),
})

/**
 * GET /api/evenements/inscription?evenementId=X — état d'inscription du visiteur
 * pour un événement (per-user, non caché). Permet à la fiche (ISR/SEO) de rester
 * statique tout en hydratant le CTA côté client.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const evenementId = Number(url.searchParams.get('evenementId'))
  if (!Number.isInteger(evenementId) || evenementId <= 0) {
    return NextResponse.json({ error: 'evenementId invalide' }, { status: 400 })
  }
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  const total = await compterInscrits(payload, evenementId)
  const connected = !!user
  const isReseauteur = user?.role === 'reseauteur'
  const inscrit = user ? await estInscrit(payload, user.id, evenementId) : false

  return NextResponse.json({ connected, isReseauteur, inscrit, total })
}

export async function POST(request: Request) {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Anti-abus : 20 opérations / minute / compte.
  const { success: allowed } = rateLimit(`inscription:${user.id}`, { limit: 20, windowMs: 60_000 })
  if (!allowed) {
    return NextResponse.json({ error: 'Trop de requêtes. Réessayez dans une minute.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  const result = parsed.data.inscrire
    ? await inscrire(payload, user.id, parsed.data.evenementId)
    : await desinscrire(payload, user.id, parsed.data.evenementId)

  if (!result.ok) {
    return NextResponse.json({ error: result.raison ?? 'Opération refusée.' }, { status: 400 })
  }
  return NextResponse.json({ ok: true, inscrit: parsed.data.inscrire, total: result.total ?? 0 })
}
