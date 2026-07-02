import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { getPayload } from 'payload'
import config from '@payload-config'
import { runDemoSeed } from '@/lib/demo-seed'
import { rateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/client-ip'

/**
 * POST/GET /api/dev/seed-demo — Injecte le jeu de données de démonstration
 * (réseaux, réseauteurs, événements, référentiels, partenaires) EN PROD, sans
 * accès shell : la fonction serverless Vercel utilise DATABASE_URL/BLOB déjà
 * configurés dans l'environnement.
 *
 * Sécurité :
 *   - DÉSACTIVÉE par défaut : renvoie 404 tant que SEED_DEMO_TOKEN n'est pas défini.
 *   - Protégée par un token secret (Authorization: Bearer <token> OU ?token=…),
 *     comparaison à temps constant.
 *   - Rate-limitée. Idempotente + additive (aucune suppression) → ré-appelable
 *     sans risque (utile si la fonction expire avant la fin).
 *
 * Mise en œuvre (aucune commande) :
 *   1. Vercel → Settings → Environment Variables : ajouter SEED_DEMO_TOKEN = <chaîne aléatoire>
 *   2. Redéployer (pour que la variable soit prise en compte)
 *   3. Ouvrir : https://<domaine>/api/dev/seed-demo?token=<chaîne aléatoire>
 *   4. Retirer SEED_DEMO_TOKEN de Vercel (désactive à nouveau la route)
 */

export const runtime = 'nodejs' // sharp (logos partenaires) nécessite le runtime Node
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function tokenMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

async function handle(request: Request): Promise<Response> {
  const expected = process.env.SEED_DEMO_TOKEN
  // Route inerte tant que le token n'est pas configuré (pas de fuite d'existence).
  if (!expected) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const ip = getClientIp(request.headers)
  const { success } = rateLimit(`seed-demo:${ip}`, { limit: 3, windowMs: 60_000 })
  if (!success) {
    return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })
  }

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null
  const provided = bearer ?? new URL(request.url).searchParams.get('token')
  if (!tokenMatches(provided, expected)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const payload = await getPayload({ config })
    const result = await runDemoSeed(payload)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[seed-demo route] échec:', err)
    return NextResponse.json(
      { error: 'Échec du seed', details: (err as Error).message },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  return handle(request)
}

export async function GET(request: Request) {
  return handle(request)
}
