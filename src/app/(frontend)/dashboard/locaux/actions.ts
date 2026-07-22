'use server'

/**
 * Server Actions — Dashboard locaux (organisateur national).
 *
 * createLocalReseau : crée un réseau local rattaché au national de l'utilisateur.
 *   Gate serveur : peutCreerLocalAsync (ADR-0012 §3 Q5)
 *   - Vérifie que l'user est organisateur
 *   - Vérifie qu'il possède un national
 *   - Vérifie que le national est abonné (partenaire = true)
 *   - Vérifie que le nombre de locaux est < maxLocaux(palier)
 *   Validation Zod côté serveur — jamais confiance au client.
 *
 * updateLocalReseau / deleteLocalReseau : modification et suppression d'un groupe
 *   existant depuis le dashboard du réseau.
 *   - Propriété vérifiée serveur par `chargerLocalAutorise` : le groupe doit être
 *     rattaché au national de l'appelant (règle umbrella) ou lui appartenir en
 *     propre. L'API générique `reseaux` reste fermée (delete = admin) — tous les
 *     gates vivent ici, en overrideAccess, comme pour la création.
 *   - Décision 2026-07-22 : les deux opérations couvrent AUSSI les groupes
 *     affiliés gérés par un autre compte (réseauteur Plus). Un groupe affilié
 *     porte le nom du réseau : la tête garde la main dessus, modification comme
 *     suppression. Le drapeau `delegue` ne bloque plus rien — il ne sert qu'à
 *     avertir l'utilisateur avant confirmation.
 *   - PAS de gate abonnement : un national dont l'abonnement a expiré garde la
 *     main sur ses groupes existants (même principe que côté réseauteur Plus) ;
 *     seule la CRÉATION est re-gatée sur le palier.
 *   - La suppression s'appuie sur les garde-fous `beforeDelete` de la collection
 *     Reseaux (refus si des événements sont rattachés) — on remonte leur message.
 */
import { headers } from 'next/headers'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { z } from 'zod/v4'
import { peutCreerLocalAsync } from '@/lib/reseau-hierarchie'
import { notifierNationalNouveauLocal } from '@/lib/notif-local-affilie'
import { revalidatePath } from 'next/cache'

const createLocalSchema = z.object({
  nom: z.string().min(1, 'Le nom est requis.').max(100, 'Le nom est trop long.'),
  ville: z.string().min(1, 'La ville est requise.').max(100, 'La ville est trop longue.'),
  description: z.string().max(500, 'La description est trop longue.').optional(),
  /** Injecté par le composant client — ignoré si fourni par l'utilisateur directement */
  reseauNationalId: z.string().min(1),
})

export type CreateLocalResult =
  | { success: true }
  | { success: false; error: string }

export async function createLocalReseau(formData: FormData): Promise<CreateLocalResult> {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) {
    return { success: false, error: 'Non authentifié. Reconnectez-vous.' }
  }

  if (user.role !== 'organisateur' && user.role !== 'admin') {
    return { success: false, error: 'Seul un compte organisateur peut créer un groupe local.' }
  }

  // Validation Zod serveur
  const parsed = createLocalSchema.safeParse({
    nom: formData.get('nom'),
    ville: formData.get('ville'),
    description: formData.get('description') || undefined,
    reseauNationalId: formData.get('reseauNationalId'),
  })

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Données invalides.'
    return { success: false, error: firstError }
  }

  const { nom, ville, description, reseauNationalId } = parsed.data

  // Vérification ownership du national déclaré (sécurité : l'utilisateur ne peut créer
  // un local que sous son propre national — pas sous celui d'un autre organisateur)
  const nationalDoc = await payload.findByID({
    collection: 'reseaux',
    id: reseauNationalId,
    depth: 0,
    overrideAccess: true,
  })

  if (!nationalDoc) {
    return { success: false, error: 'Réseau national introuvable.' }
  }

  const nationalDocRaw = nationalDoc as unknown as Record<string, unknown>
  const nationalNiveau = nationalDocRaw.niveau as string | null | undefined
  if (nationalNiveau === 'local') {
    return {
      success: false,
      error: 'Ce réseau est un groupe local. Impossible d\'y rattacher un autre groupe (hiérarchie à 2 étages).',
    }
  }

  const nationalOwnerRel = nationalDocRaw.user
  const nationalOwnerId: number | string | null =
    typeof nationalOwnerRel === 'object' && nationalOwnerRel !== null
      ? ((nationalOwnerRel as { id?: number | string }).id ?? null)
      : (typeof nationalOwnerRel === 'string' || typeof nationalOwnerRel === 'number'
          ? nationalOwnerRel
          : null)

  // Un admin peut créer pour n'importe quel national ; l'organisateur doit être propriétaire
  if (user.role !== 'admin' && String(nationalOwnerId) !== String(user.id)) {
    return {
      success: false,
      error: 'Vous ne pouvez créer des groupes que pour votre propre réseau national.',
    }
  }

  // Gate palier : abonnement actif + capacité disponible
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gate = await peutCreerLocalAsync(user.role === 'admin' ? (nationalOwnerId ?? user.id) : user.id, payload as any)
  if (!gate.autorise) {
    return { success: false, error: gate.raison ?? 'Création non autorisée.' }
  }

  // Conversion en nombre (les IDs Payload sont des nombres en PostgreSQL)
  const parentIdNum = Number(reseauNationalId)
  const ownerIdNum = nationalOwnerId !== null ? Number(nationalOwnerId) : undefined

  // Création du local (slug auto-généré par le hook beforeValidate de Reseaux)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (payload.create as any)({
      collection: 'reseaux',
      data: {
        nom,
        ville,
        description,
        niveau: 'local',
        parent: parentIdNum,
        // L'user du local = l'owner du national (auto-géré par défaut — Q2 ADR-0012)
        user: ownerIdNum,
        statut: 'publiee',
        source: 'revendique',
      },
      overrideAccess: true,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[dashboard/locaux/actions] createLocalReseau failed: ${message}`)
    return { success: false, error: 'Erreur lors de la création du groupe. Réessayez.' }
  }

  // Revalidation des pages dashboard
  revalidatePath('/dashboard/locaux')
  revalidatePath('/dashboard/reseau')

  // Notification de la tête d'affiliation (décision 2026-07-22). No-op quand le
  // national crée lui-même son groupe (cas nominal ici) ; l'email ne part que si
  // l'auteur est un tiers — typiquement un admin créant pour un autre réseau.
  await notifierNationalNouveauLocal({
    payload,
    parentId: parentIdNum,
    nomLocal: nom,
    villeLocal: ville,
    createurUserId: user.id,
    createurNom: (user as { nomSociete?: string | null }).nomSociete ?? 'Un administrateur',
  })

  return { success: true }
}

// ─────────────────────────────────────────────────────────────────
// Modification / suppression d'un groupe local existant
// ─────────────────────────────────────────────────────────────────

/** Extrait l'id d'une relation Payload, qu'elle soit peuplée ou non. */
function relationId(rel: unknown): number | string | null {
  if (rel === null || rel === undefined) return null
  if (typeof rel === 'object') return (rel as { id?: number | string }).id ?? null
  return rel as number | string
}

interface LocalAutorise {
  id: number | string
  nom: string
  slug: string | null
  /** Vrai si le groupe est géré par un autre compte que le propriétaire du national. */
  delegue: boolean
}

/**
 * Charge un groupe local et vérifie que l'appelant a le droit d'agir dessus.
 *
 * Deux titres valables (hors admin) :
 *   - umbrella : le groupe est rattaché (`parent`) au national de l'appelant ;
 *   - propriété directe : le groupe lui a été délégué (`user` = appelant).
 */
async function chargerLocalAutorise(
  payload: Payload,
  user: { id: number | string; role?: string | null },
  localId: number | string,
): Promise<{ ok: true; local: LocalAutorise } | { ok: false; error: string }> {
  let doc: Record<string, unknown> | null = null
  try {
    doc = (await payload.findByID({
      collection: 'reseaux',
      id: localId,
      depth: 0,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
  } catch {
    doc = null
  }
  if (!doc) return { ok: false, error: 'Groupe local introuvable.' }

  if (doc.niveau !== 'local') {
    return {
      ok: false,
      error: 'Ce réseau est une tête de réseau, pas un groupe local. Gérez-le depuis « Mon réseau ».',
    }
  }

  const localOwnerId = relationId(doc.user)
  const parentId = relationId(doc.parent)
  const base = {
    id: doc.id as number | string,
    nom: String(doc.nom ?? ''),
    slug: (doc.slug as string | null) ?? null,
  }

  if (user.role === 'admin') {
    return { ok: true, local: { ...base, delegue: false } }
  }

  // National de l'appelant (une tête par compte — cf. resolveAbonnement).
  const { docs: nationaux } = await payload.find({
    collection: 'reseaux',
    where: { and: [{ user: { equals: user.id } }, { niveau: { not_equals: 'local' } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const national = nationaux[0] as unknown as Record<string, unknown> | undefined

  const parUmbrella =
    national != null && parentId != null && String(parentId) === String(national.id)
  const parPropriete = localOwnerId != null && String(localOwnerId) === String(user.id)

  if (!parUmbrella && !parPropriete) {
    return { ok: false, error: 'Vous ne pouvez gérer que les groupes de votre propre réseau.' }
  }

  // Délégué = confié à un autre compte que le propriétaire du national.
  const nationalOwnerId = national ? relationId(national.user) : null
  const delegue =
    localOwnerId != null &&
    nationalOwnerId != null &&
    String(localOwnerId) !== String(nationalOwnerId)

  return { ok: true, local: { ...base, delegue } }
}

const updateLocalSchema = z.object({
  nom: z.string().min(1, 'Le nom est requis.').max(100, 'Le nom est trop long.'),
  ville: z.string().min(1, 'La ville est requise.').max(100, 'La ville est trop longue.'),
  description: z.string().max(500, 'La description est trop longue.').optional(),
})

export type MutateLocalResult = { success: true } | { success: false; error: string }

/** Modifie le nom, la ville et la description d'un groupe local possédé. */
export async function updateLocalReseau(formData: FormData): Promise<MutateLocalResult> {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) return { success: false, error: 'Non authentifié. Reconnectez-vous.' }
  if (user.role !== 'organisateur' && user.role !== 'admin') {
    return { success: false, error: 'Seul un compte organisateur peut modifier un groupe local.' }
  }

  const localId = formData.get('localId')
  if (typeof localId !== 'string' || localId.length === 0) {
    return { success: false, error: 'Groupe local non identifié.' }
  }

  const parsed = updateLocalSchema.safeParse({
    nom: formData.get('nom'),
    ville: formData.get('ville'),
    description: formData.get('description') || undefined,
  })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides.' }
  }

  const acces = await chargerLocalAutorise(payload, user, localId)
  if (!acces.ok) return { success: false, error: acces.error }

  try {
    await payload.update({
      collection: 'reseaux',
      id: localId,
      data: {
        nom: parsed.data.nom.trim(),
        ville: parsed.data.ville.trim(),
        description: parsed.data.description?.trim() ?? '',
      } as never,
      overrideAccess: true,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[dashboard/locaux/actions] updateLocalReseau failed: ${message}`)
    return { success: false, error: 'Erreur lors de la modification du groupe. Réessayez.' }
  }

  revalidatePath('/dashboard/locaux')
  revalidatePath('/dashboard/reseau')
  revalidatePath('/reseaux')
  // Le slug est figé à la création (contrat SEO ADR-0005) : la fiche publique
  // garde son URL, seul son contenu change.
  if (acces.local.slug) revalidatePath(`/reseau/${acces.local.slug}`)

  return { success: true }
}

/** Supprime un groupe local possédé. Refusé si des événements y sont rattachés. */
export async function deleteLocalReseau(formData: FormData): Promise<MutateLocalResult> {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) return { success: false, error: 'Non authentifié. Reconnectez-vous.' }
  if (user.role !== 'organisateur' && user.role !== 'admin') {
    return { success: false, error: 'Seul un compte organisateur peut supprimer un groupe local.' }
  }

  const localId = formData.get('localId')
  if (typeof localId !== 'string' || localId.length === 0) {
    return { success: false, error: 'Groupe local non identifié.' }
  }

  const acces = await chargerLocalAutorise(payload, user, localId)
  if (!acces.ok) return { success: false, error: acces.error }

  // Décision 2026-07-22 : le national supprime TOUS les groupes qui lui sont
  // affiliés, y compris ceux gérés par un autre compte (réseauteur Plus affilié).
  // Un groupe porte le nom du réseau : la tête reste juge de ce qui s'y rattache.
  // L'ancien refus sur `delegue` est levé ; le drapeau ne sert plus qu'à avertir
  // dans la confirmation côté UI.

  try {
    await payload.delete({
      collection: 'reseaux',
      id: localId,
      overrideAccess: true,
    })
  } catch (err) {
    // Les hooks beforeDelete de la collection Reseaux portent déjà des messages FR
    // explicites (« … N événement(s) y sont rattaché(s) … ») : on les remonte tels quels.
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[dashboard/locaux/actions] deleteLocalReseau failed: ${message}`)
    return {
      success: false,
      error: message.replace(/^ValidationError:?\s*/i, '') || 'Erreur lors de la suppression.',
    }
  }

  revalidatePath('/dashboard/locaux')
  revalidatePath('/dashboard/reseau')
  revalidatePath('/reseaux')

  return { success: true }
}
