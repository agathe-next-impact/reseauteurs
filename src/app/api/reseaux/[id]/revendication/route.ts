/**
 * /api/reseaux/:id/revendication — Revendication d'une fiche de tête de réseau orpheline.
 *
 * GET  : état de la revendication pour le visiteur courant. Sert deux surfaces —
 *        le CTA de la fiche publique (qui reste ISR : l'état per-user est hydraté
 *        côté client, jamais rendu dans le HTML statique) et la bannière de la page
 *        d'inscription (`/inscription?claim=<id>`).
 * POST : revendication par un utilisateur DÉJÀ CONNECTÉ. Le parcours « nouvel
 *        utilisateur » ne passe pas ici : il est atomique à la création du compte
 *        (POST /api/auth/register avec `claimReseauId`).
 *
 * Toutes les règles vivent dans `lib/revendication-reseau` — jamais dans le client.
 * Réponses volontairement non mises en cache : elles dépendent de la session.
 */
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import {
  chargerReseauRevendicable,
  eligibiliteCompte,
  revendiquerPour,
} from '@/lib/revendication-reseau'
import { rateLimit } from '@/lib/rate-limit'

const NO_STORE = { 'Cache-Control': 'no-store' } as const

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const payload = await getPayload({ config })

  const fiche = await chargerReseauRevendicable(payload, id)
  if (!fiche.ok) {
    return NextResponse.json(
      { revendicable: false, raison: fiche.error },
      { headers: NO_STORE },
    )
  }

  // Session : absente = visiteur anonyme (cas nominal sur une fiche publique).
  const hdrs = await headers()
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) {
    return NextResponse.json(
      { revendicable: true, nom: fiche.reseau.nom, connecte: false, eligible: false },
      { headers: NO_STORE },
    )
  }

  // Rôle lu FRAIS : le JWT peut être périmé après un changement de rôle en admin.
  const freshUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    depth: 0,
    overrideAccess: true,
  })
  const eligibilite = await eligibiliteCompte(payload, {
    id: user.id,
    role: (freshUser as { role?: string | null }).role,
  })

  return NextResponse.json(
    {
      revendicable: true,
      nom: fiche.reseau.nom,
      connecte: true,
      eligible: eligibilite.ok,
      ...(eligibilite.ok ? {} : { motif: eligibilite.error }),
    },
    { headers: NO_STORE },
  )
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const payload = await getPayload({ config })

  const hdrs = await headers()
  const { user } = await payload.auth({ headers: hdrs })
  if (!user) {
    return NextResponse.json(
      { error: 'Connectez-vous pour revendiquer ce réseau.' },
      { status: 401, headers: NO_STORE },
    )
  }

  // Anti-abus : une revendication prend le contrôle d'une fiche publique.
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  const { success: allowed } = rateLimit(`revendication:${user.id}:${ip}`, {
    limit: 10,
    windowMs: 3_600_000,
  })
  if (!allowed) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessayez plus tard.' },
      { status: 429, headers: NO_STORE },
    )
  }

  const fiche = await chargerReseauRevendicable(payload, id)
  if (!fiche.ok) {
    return NextResponse.json({ error: fiche.error }, { status: 409, headers: NO_STORE })
  }

  const freshUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    depth: 0,
    overrideAccess: true,
  })
  const eligibilite = await eligibiliteCompte(payload, {
    id: user.id,
    role: (freshUser as { role?: string | null }).role,
  })
  if (!eligibilite.ok) {
    return NextResponse.json({ error: eligibilite.error }, { status: 403, headers: NO_STORE })
  }

  const resultat = await revendiquerPour(payload, fiche.reseau.id, user.id)
  if (!resultat.ok) {
    return NextResponse.json({ error: resultat.error }, { status: 409, headers: NO_STORE })
  }

  try {
    revalidatePath('/reseaux')
    if (fiche.reseau.slug) revalidatePath(`/reseau/${fiche.reseau.slug}`)
    revalidatePath('/dashboard/reseau')
  } catch {
    /* hors contexte request */
  }

  return NextResponse.json(
    { ok: true, redirect: '/dashboard/reseau' },
    { headers: NO_STORE },
  )
}
