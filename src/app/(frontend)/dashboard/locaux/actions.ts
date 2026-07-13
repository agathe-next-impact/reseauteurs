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
 */
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod/v4'
import { peutCreerLocalAsync } from '@/lib/reseau-hierarchie'
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
    return { success: false, error: 'Seul un compte organisateur peut créer un chapitre local.' }
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
      error: 'Ce réseau est un chapitre local. Impossible d\'y rattacher un autre chapitre (hiérarchie à 2 étages).',
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
      error: 'Vous ne pouvez créer des chapitres que pour votre propre réseau national.',
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
    return { success: false, error: 'Erreur lors de la création du chapitre. Réessayez.' }
  }

  // Revalidation des pages dashboard
  revalidatePath('/dashboard/locaux')
  revalidatePath('/dashboard/reseau')

  return { success: true }
}
