/**
 * POST /api/auth/verify — Vérification d'email, avec résolution de la revendication.
 *
 * Enveloppe l'opération native de Payload (`payload.verifyEmail`) au lieu d'appeler
 * `POST /api/users/verify/:token` directement, pour deux raisons :
 *
 *  1. la revendication d'une fiche de réseau est appliquée ICI, une fois l'email
 *     prouvé (décision 2026-07-22) — un compte non vérifié ne peut donc plus
 *     immobiliser une fiche de l'annuaire national ;
 *  2. cet enchaînement doit être garanti côté serveur. Le brancher sur un hook de
 *     collection serait fragile : l'opération de vérification de Payload ne passe pas
 *     nécessairement par le cycle de hooks `afterChange` d'une mise à jour normale.
 *
 * Le compte est résolu AVANT la vérification (le jeton est consommé au passage) ; la
 * revendication est ensuite best-effort et ne peut jamais faire échouer une
 * vérification qui a réussi.
 */
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resoudreClaimEnAttente, rattacherFichesParEmail } from '@/lib/revendication-reseau'
import { rateLimit } from '@/lib/rate-limit'

const NO_STORE = { 'Cache-Control': 'no-store' } as const

export async function POST(request: Request) {
  // Anti-force brute sur le jeton (endpoint non authentifié).
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  const { success: allowed } = rateLimit(`verify:${ip}`, { limit: 20, windowMs: 3_600_000 })
  if (!allowed) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessayez plus tard.' },
      { status: 429, headers: NO_STORE },
    )
  }

  let token: string | null = null
  try {
    const body = (await request.json()) as { token?: unknown }
    token = typeof body?.token === 'string' ? body.token.trim() : null
  } catch {
    token = null
  }
  if (!token) {
    return NextResponse.json(
      { error: 'Token de vérification manquant.' },
      { status: 400, headers: NO_STORE },
    )
  }

  const payload = await getPayload({ config })

  // Résolution du compte AVANT vérification : le jeton est effacé par l'opération.
  let compte: {
    id: number | string
    email?: string | null
    role?: string | null
    nomSociete?: string | null
    ville?: string | null
  } | null = null
  try {
    const { docs } = await payload.find({
      collection: 'users',
      where: { _verificationToken: { equals: token } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      showHiddenFields: true,
    })
    const doc = docs[0] as unknown as Record<string, unknown> | undefined
    if (doc) {
      compte = {
        id: doc.id as number | string,
        email: (doc.email as string | null) ?? null,
        role: (doc.role as string | null) ?? null,
        nomSociete: (doc.nomSociete as string | null) ?? null,
        ville: (doc.ville as string | null) ?? null,
      }
    }
  } catch (err) {
    console.error('[auth/verify] résolution du compte impossible:', err)
  }

  try {
    await payload.verifyEmail({ collection: 'users', token })
  } catch {
    // Message volontairement générique : ne pas distinguer jeton inconnu / expiré.
    return NextResponse.json(
      { error: 'Le lien de vérification est invalide ou a expiré.' },
      { status: 400, headers: NO_STORE },
    )
  }

  // Email prouvé → la revendication mise en attente peut être appliquée.
  // `resoudreClaimEnAttente` ne jette jamais et purge le marqueur dans tous les cas.
  if (compte) {
    await resoudreClaimEnAttente(payload, compte)
    // Rattachement automatique par email de contact (organisateur/admin sans tête) :
    // best-effort, APRÈS la revendication (qui a pu déjà donner une tête au compte).
    await rattacherFichesParEmail(payload, compte)
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
