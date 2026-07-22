/**
 * POST /api/evenements/inscription — s'inscrire / se désinscrire d'un événement Plus (ADR-0013 §3bis).
 *
 * Body : { evenementId: number, inscrire: boolean }
 * Auth : réseauteur connecté. Rate-limité. Toutes les règles (événement Plus, publié,
 * à venir, unicité) sont vérifiées serveur — lib/inscriptions.ts.
 */
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { z } from 'zod/v4'
import { rateLimit } from '@/lib/rate-limit'
import { inscrire, desinscrire, compterInscrits, estInscrit } from '@/lib/inscriptions'

/**
 * Les deux fiches publiques listent désormais les participants (fiche événement) et les
 * événements (fiche réseauteur) — on les revalide pour que l'inscription apparaisse
 * immédiatement, sans attendre la fenêtre ISR de 300 s.
 */
async function revaliderFiches(payload: Payload, evenementId: number, userId: number | string) {
  try {
    const [{ docs: evs }, { docs: rzs }] = await Promise.all([
      payload.find({
        collection: 'evenements',
        where: { id: { equals: evenementId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        select: { slug: true } as Record<string, boolean>,
      }),
      payload.find({
        collection: 'reseauteurs',
        where: { user: { equals: Number(userId) } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        select: { slug: true } as Record<string, boolean>,
      }),
    ])
    const evSlug = (evs[0] as { slug?: string | null } | undefined)?.slug
    const rzSlug = (rzs[0] as { slug?: string | null } | undefined)?.slug
    if (evSlug) revalidatePath(`/evenement/${evSlug}`, 'page')
    if (rzSlug) revalidatePath(`/reseauteur/${rzSlug}`, 'page')
  } catch {
    // Best-effort : l'ISR (300 s) reste le filet de sécurité.
  }
}

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
  await revaliderFiches(payload, parsed.data.evenementId, user.id)
  return NextResponse.json({ ok: true, inscrit: parsed.data.inscrire, total: result.total ?? 0 })
}
