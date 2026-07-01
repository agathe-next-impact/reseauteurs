/**
 * POST /api/admin/deleguer-local
 *
 * Réassigne `local.user` à un compte organisateur cible (délégation Q2 — ADR-0012 §6).
 *
 * Mécanisme de délégation admin-only (verrouillé) :
 *   - Seul un admin peut déléguer un local.
 *   - Le compte cible (`organisateurId`) doit exister et avoir le rôle 'organisateur'.
 *   - Le local (`localId`) doit être de niveau='local'.
 *   - Si `creerCompte: true`, crée un nouveau compte organisateur avec
 *     req.context.skipAutoCreateReseau = true (pas d'auto-création de national — ADR-0012 E1.5).
 *
 * Deux modes :
 *   A. Délégation vers un compte existant : `{ localId, organisateurId }`
 *   B. Création + délégation            : `{ localId, email, nomSociete, ville }`
 *
 * Garanties :
 *   - Le délégué ne possède pas de national → il ne peut pas créer de locaux ni souscrire.
 *   - L'umbrella (national garde la main via peutGererReseau) est préservé.
 *   - Le local ne peut pas avoir deux délégués simultanés (réassignation simple).
 *
 * Note : la révocation se fait par une nouvelle délégation vers le compte national
 * ou en réassignant local.user = national.user via cette route.
 */
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod/v4'
import { rateLimit } from '@/lib/rate-limit'

const bodySchema = z.discriminatedUnion('mode', [
  // Mode A : déléguer vers un compte organisateur existant
  z.object({
    mode: z.literal('existant'),
    localId: z.string().min(1),
    organisateurId: z.string().min(1),
  }),
  // Mode B : créer un compte organisateur délégué et l'assigner immédiatement
  z.object({
    mode: z.literal('creer'),
    localId: z.string().min(1),
    email: z.email('Email invalide.'),
    nomSociete: z.string().min(1).max(100),
    ville: z.string().min(1).max(100),
    /** Mot de passe temporaire (min 8 car.). L'admin communique ce mdp au délégué. */
    password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.'),
  }),
])

export async function POST(request: Request) {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // Accès strictement limité aux admins (ADR-0012 §6 — délégation admin-only Q2)
  if (user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Accès réservé aux administrateurs RÉSEAUTEURS.' },
      { status: 403 },
    )
  }

  const { success: allowed } = rateLimit(`admin-deleguer:${user.id}`, {
    limit: 20,
    windowMs: 60_000,
  })
  if (!allowed) {
    return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Paramètres invalides', details: parsed.error.issues },
      { status: 400 },
    )
  }

  // ── Validation du local cible
  const localDoc = await payload.findByID({
    collection: 'reseaux',
    id: parsed.data.localId,
    depth: 1,
    overrideAccess: true,
  })
  if (!localDoc) {
    return NextResponse.json({ error: 'Réseau local introuvable.' }, { status: 404 })
  }
  const localDocRaw = localDoc as unknown as Record<string, unknown>
  const niveauLocal = localDocRaw.niveau as string | null | undefined
  if (niveauLocal !== 'local') {
    return NextResponse.json(
      {
        error:
          `Le réseau '${localDocRaw.nom as string}' est de niveau '${niveauLocal ?? 'national'}'. ` +
          'Seul un réseau local peut être délégué.',
      },
      { status: 400 },
    )
  }

  let delegueUserId: string | number

  if (parsed.data.mode === 'existant') {
    // ── Mode A : déléguer vers un compte existant
    const organisateur = await payload.findByID({
      collection: 'users',
      id: parsed.data.organisateurId,
      overrideAccess: true,
    })
    if (!organisateur) {
      return NextResponse.json({ error: 'Compte organisateur introuvable.' }, { status: 404 })
    }
    if (organisateur.role !== 'organisateur') {
      return NextResponse.json(
        {
          error: `Ce compte a le rôle '${organisateur.role}', pas 'organisateur'. ` +
                 'Modifiez le rôle avant de déléguer.',
        },
        { status: 400 },
      )
    }

    // Vérification : le délégué cible ne doit pas posséder un national
    // (sinon il pourrait souscrire une subscription indépendante — confusion)
    const { totalDocs: nbNationaux } = await payload.count({
      collection: 'reseaux',
      where: {
        and: [
          { user: { equals: organisateur.id } },
          { niveau: { equals: 'national' } },
        ],
      },
      overrideAccess: true,
    })
    if (nbNationaux > 0) {
      return NextResponse.json(
        {
          error:
            'Ce compte organisateur possède déjà un réseau national. ' +
            'Un délégué ne doit pas posséder de national (ADR-0012 §6). ' +
            'Utilisez un compte dédié à la délégation.',
        },
        { status: 409 },
      )
    }

    delegueUserId = organisateur.id
  } else {
    // ── Mode B : créer un nouveau compte organisateur délégué
    // skipAutoCreateReseau = true → pas d'auto-création de national (ADR-0012 E1.5)
    try {
      const newUser = await payload.create({
        collection: 'users',
        data: {
          email: parsed.data.email,
          password: parsed.data.password,
          nomSociete: parsed.data.nomSociete,
          ville: parsed.data.ville,
          role: 'organisateur',
        },
        overrideAccess: true,
        // Signal au hook afterChange de Users.ts de ne PAS auto-créer un national
        context: { skipAutoCreateReseau: true },
      })
      delegueUserId = newUser.id
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (/duplicate|unique/i.test(message)) {
        return NextResponse.json(
          { error: `Un compte avec l'email '${parsed.data.email}' existe déjà.` },
          { status: 409 },
        )
      }
      console.error('[admin/deleguer-local] Création compte délégué failed:', err)
      return NextResponse.json(
        { error: 'Erreur lors de la création du compte délégué.' },
        { status: 500 },
      )
    }
  }

  // ── Réassignation de local.user → délégué
  try {
    await payload.update({
      collection: 'reseaux',
      id: parsed.data.localId,
      data: { user: delegueUserId },
      overrideAccess: true,
      context: { webhookTrusted: true },
    })
  } catch (err) {
    console.error('[admin/deleguer-local] Réassignation user failed:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la réassignation du chapitre.' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    success: true,
    localId: parsed.data.localId,
    delegueUserId: String(delegueUserId),
    mode: parsed.data.mode,
  })
}
