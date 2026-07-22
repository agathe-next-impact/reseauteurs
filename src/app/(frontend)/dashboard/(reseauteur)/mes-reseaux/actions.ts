'use server'

/**
 * Server actions — Réseaux locaux d'un réseauteur Plus (ADR-0014).
 *
 * Un réseauteur Plus peut créer jusqu'à MAX_LOCAUX_PLUS fiches de réseaux locaux,
 * affiliées à une tête de réseau existante (affiliation LIBRE — l'admin corrige en
 * back-office si besoin) ou indépendantes (sans parent). Il peut aussi inviter par
 * email un réseau national absent de la plateforme à créer son compte organisateur.
 *
 * Autorisation stricte — jamais confiance au client :
 *   - création : rôle reseauteur + Plus actif (statut lu FRAIS) + quota serveur ;
 *   - édition  : rôle reseauteur + PROPRIÉTÉ du réseau local (un Plus expiré garde
 *     l'édition de ses fiches ; seules les créations sont re-gatées) ;
 *   - la création passe en overrideAccess (l'API générique reseaux est fermée) —
 *     tous les gates vivent ici, comme createLocalReseau côté organisateur.
 */
import { headers } from 'next/headers'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { z } from 'zod/v4'
import { estPlus } from '@/lib/acces-plus'
import { peutCreerLocalPlusAsync } from '@/lib/reseau-hierarchie'
import { rateLimit } from '@/lib/rate-limit'
import { hashUserId } from '@/lib/audit'
import { sendEmail } from '@/lib/email-sender'
import { invitationNationalEmail } from '@/lib/emails'
import { notifierNationalNouveauLocal } from '@/lib/notif-local-affilie'

type ActionResult = { ok: true; id?: number | string } | { ok: false; error: string }

type ReseauteurContext =
  | { ok: false; error: string }
  | { ok: true; payload: Payload; userId: number | string; freshUser: Record<string, unknown> }

async function getReseauteurContext(): Promise<ReseauteurContext> {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })
  if (!user) return { ok: false, error: 'Non authentifié.' }
  const freshUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    depth: 0,
    overrideAccess: true,
  })
  if ((freshUser as { role?: string }).role !== 'reseauteur') {
    return { ok: false, error: 'Accès réservé aux réseauteurs.' }
  }
  return { ok: true, payload, userId: user.id, freshUser: freshUser as unknown as Record<string, unknown> }
}

/** Gate Plus sur user FRAIS (jamais le JWT) — source unique lib/acces-plus. */
const estPlusFrais = (u: Record<string, unknown>) =>
  estPlus(u as unknown as { id: number | string; plusActif?: boolean | null; plusExpireAt?: string | null })

// ─────────────────────────────────────────────────────────────────
// Création d'un réseau local (affilié ou indépendant)
// ─────────────────────────────────────────────────────────────────

const CreateReseauLocalSchema = z.object({
  nom: z.string().min(1, 'Le nom est requis').max(100),
  ville: z.string().min(1, 'La ville est requise').max(100),
  description: z.string().max(500).optional(),
  /** Tête de réseau parente — null/absent = réseau local indépendant (ADR-0014). */
  parentId: z.number().int().positive().nullable().optional(),
})

export async function createMonReseauLocal(
  data: z.infer<typeof CreateReseauLocalSchema>,
): Promise<ActionResult> {
  const ctx = await getReseauteurContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }
  const { payload, userId, freshUser } = ctx

  if (!estPlusFrais(freshUser)) {
    return {
      ok: false,
      error: 'La création de réseaux locaux est réservée aux réseauteurs Plus. Passez Plus depuis votre tableau de bord.',
    }
  }

  const parsed = CreateReseauLocalSchema.safeParse(data)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' }
  }

  // Quota serveur (MAX_LOCAUX_PLUS)
  const quota = await peutCreerLocalPlusAsync(userId, payload as unknown as Parameters<typeof peutCreerLocalPlusAsync>[1])
  if (!quota.autorise) {
    return { ok: false, error: quota.raison ?? 'Vous ne pouvez pas créer de réseau local supplémentaire.' }
  }

  // Affiliation libre : le parent, s'il est fourni, doit exister et être une tête
  const parentId = parsed.data.parentId ?? null
  if (parentId != null) {
    let parent: { niveau?: string | null } | null = null
    try {
      parent = (await payload.findByID({
        collection: 'reseaux',
        id: parentId,
        depth: 0,
        overrideAccess: true,
      })) as { niveau?: string | null }
    } catch {
      parent = null
    }
    if (!parent) return { ok: false, error: 'Le réseau national sélectionné est introuvable.' }
    if (parent.niveau === 'local') {
      return { ok: false, error: 'Le réseau parent doit être une tête de réseau (hiérarchie à 2 étages).' }
    }
  }

  try {
    const created = await payload.create({
      collection: 'reseaux',
      data: {
        nom: parsed.data.nom.trim(),
        ville: parsed.data.ville.trim(),
        description: parsed.data.description?.trim() || '',
        niveau: 'local',
        parent: parentId,
        user: Number(userId),
        statut: 'publiee',
        source: 'revendique',
      } as never,
      overrideAccess: true,
    })
    revalidatePath('/dashboard/mes-reseaux')
    revalidatePath('/reseaux')

    // Notification de la tête de réseau (décision 2026-07-22) — best-effort :
    // le helper n'échoue jamais, la création reste acquise même si l'email tombe.
    await notifierNationalNouveauLocal({
      payload,
      parentId,
      nomLocal: parsed.data.nom.trim(),
      villeLocal: parsed.data.ville.trim(),
      createurUserId: userId,
      createurNom:
        (freshUser.nomSociete as string | null | undefined) ?? 'Un réseauteur de la plateforme',
    })

    return { ok: true, id: created.id }
  } catch (err) {
    console.error('[action/createMonReseauLocal]', err)
    const msg = err instanceof Error ? err.message.replace(/^ValidationError:?\s*/i, '') : null
    return { ok: false, error: msg || 'Erreur lors de la création du réseau.' }
  }
}

// ─────────────────────────────────────────────────────────────────
// Édition de la fiche d'un réseau local possédé
// ─────────────────────────────────────────────────────────────────

const UpdateReseauLocalSchema = z.object({
  nom: z.string().min(1, 'Le nom est requis').max(200),
  ville: z.string().max(100).optional(),
  description: z.string().max(3000).optional(),
  presentation: z.string().max(5000).optional(),
  siteWeb: z.string().url('URL invalide').optional().or(z.literal('')),
  emailContact: z.string().email('Email invalide').optional().or(z.literal('')),
  telephone: z.string().max(30).optional().or(z.literal('')),
})

export async function updateMonReseauLocal(
  reseauId: number | string,
  data: z.infer<typeof UpdateReseauLocalSchema>,
): Promise<ActionResult> {
  const ctx = await getReseauteurContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }
  const { payload, userId } = ctx

  // Ownership strict : uniquement SES réseaux locaux (parent/niveau jamais modifiés ici)
  type ReseauLocalDoc = { id: number | string; niveau?: string | null; user?: unknown; slug?: string | null }
  let reseau: ReseauLocalDoc | null = null
  try {
    reseau = (await payload.findByID({
      collection: 'reseaux',
      id: reseauId,
      depth: 0,
      overrideAccess: true,
    })) as unknown as ReseauLocalDoc
  } catch {
    reseau = null
  }
  if (!reseau) return { ok: false, error: 'Réseau introuvable.' }
  const ownerId =
    typeof reseau.user === 'object' && reseau.user !== null
      ? (reseau.user as { id?: number | string }).id
      : (reseau.user as number | string | null | undefined)
  if (reseau.niveau !== 'local' || ownerId == null || String(ownerId) !== String(userId)) {
    return { ok: false, error: 'Vous ne pouvez modifier que vos propres réseaux locaux.' }
  }

  const parsed = UpdateReseauLocalSchema.safeParse(data)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' }
  }
  const d = parsed.data

  try {
    await payload.update({
      collection: 'reseaux',
      id: reseauId,
      data: {
        nom: d.nom.trim(),
        ville: d.ville?.trim() || null,
        description: d.description ?? '',
        presentation: d.presentation ?? '',
        siteWeb: d.siteWeb || null,
        emailContact: d.emailContact || null,
        telephone: d.telephone || null,
      } as never,
      overrideAccess: true,
    })
    revalidatePath('/dashboard/mes-reseaux')
    if (reseau.slug) revalidatePath(`/reseau/${reseau.slug}`)
    return { ok: true, id: reseauId }
  } catch (err) {
    console.error('[action/updateMonReseauLocal]', err)
    const msg = err instanceof Error ? err.message.replace(/^ValidationError:?\s*/i, '') : null
    return { ok: false, error: msg || 'Erreur lors de la mise à jour de la fiche.' }
  }
}

// ─────────────────────────────────────────────────────────────────
// Invitation email d'un réseau national absent de la plateforme
// ─────────────────────────────────────────────────────────────────

const InvitationSchema = z.object({
  nomReseau: z.string().min(1, 'Le nom du réseau est requis').max(200),
  email: z.string().email('Email invalide').max(254),
})

export async function inviterReseauNational(
  data: z.infer<typeof InvitationSchema>,
): Promise<ActionResult> {
  const ctx = await getReseauteurContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }
  const { payload, userId, freshUser } = ctx

  if (!estPlusFrais(freshUser)) {
    return { ok: false, error: 'L\'invitation d\'un réseau national est réservée aux réseauteurs Plus.' }
  }

  const parsed = InvitationSchema.safeParse(data)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' }
  }

  // Anti-abus : 3 invitations par jour et par compte (best-effort serverless)
  const rl = rateLimit(`invite-national:${userId}`, { limit: 3, windowMs: 86_400_000 })
  if (!rl.success) {
    return { ok: false, error: 'Limite atteinte : 3 invitations par jour. Réessayez demain.' }
  }

  const inviteurNom = (freshUser.nomSociete as string | null | undefined) ?? 'Un réseauteur'

  try {
    const result = await sendEmail({
      payload,
      kind: 'invitation-national',
      to: parsed.data.email,
      subject: `RÉSEAUTEURS — ${parsed.data.nomReseau} est invité à créer la fiche de son réseau`,
      html: invitationNationalEmail(parsed.data.nomReseau, inviteurNom),
    })
    if (!result.sent && result.skipped !== 'dry-run') {
      return { ok: false, error: 'L\'email d\'invitation n\'a pas pu être envoyé. Réessayez plus tard.' }
    }
  } catch (err) {
    console.error('[action/inviterReseauNational]', err)
    return { ok: false, error: 'L\'email d\'invitation n\'a pas pu être envoyé. Réessayez plus tard.' }
  }

  // Trace RGPD-friendly : jamais l'email en clair (domaine seulement)
  try {
    await payload.create({
      collection: 'audit-logs',
      data: {
        type: 'national_invited',
        userIdHash: hashUserId(userId),
        metadata: {
          nomReseau: parsed.data.nomReseau,
          emailDomain: parsed.data.email.split('@')[1] ?? '',
        },
      } as never,
      overrideAccess: true,
    })
  } catch (err) {
    console.error('[action/inviterReseauNational] audit-log failed:', err)
  }

  return { ok: true }
}
