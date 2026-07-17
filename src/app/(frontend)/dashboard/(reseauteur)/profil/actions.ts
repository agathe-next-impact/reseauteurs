/**
 * Server Actions — Dashboard réseauteur
 *
 * Toutes les mutations de profil passent par ces actions serveur.
 * Autorisation stricte : le user ne peut agir que sur SON profil
 * (le guard est dans l'access.update de la collection Reseauteurs : `{ user: { equals: user.id } }`).
 *
 * Validation Zod côté serveur — jamais confiance au client.
 */
'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod/v4'

// ─────────────────────────────────────────────────────────────────
// Schéma de validation du profil réseauteur
// ─────────────────────────────────────────────────────────────────

const ProfilSchema = z.object({
  prenom: z.string().min(1, 'Le prénom est requis').max(100),
  nom: z.string().min(1, 'Le nom est requis').max(100),
  fonction: z.string().max(200).optional(),
  entreprise: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  // Contacts facultatifs — le réseauteur contrôle ce qu'il partage
  telephone: z.string().max(30).optional().or(z.literal('')),
  emailContact: z.string().email('Email invalide').optional().or(z.literal('')),
  site: z.string().url('URL invalide').optional().or(z.literal('')),
  linkedin: z
    .string()
    .refine((v) => !v || v.includes('linkedin.com'), 'Doit être un profil LinkedIn')
    .optional()
    .or(z.literal('')),
  ville: z.string().min(1, 'La ville est requise').max(100),
  departement: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  evenementsParMois: z.number().int().min(0).max(999),
  // Confidentialité RGPD
  noindex: z.boolean().optional(),
  // Affiliation réseaux LOCAUX uniquement (ADR-0012) — validée côté collection serveur
  reseauxFrequentes: z.array(z.number().int().positive()).max(20, 'Maximum 20 réseaux').optional(),
})

export type ProfilFormData = z.infer<typeof ProfilSchema>
export type ActionResult = { success: true } | { error: string }

// ─────────────────────────────────────────────────────────────────
// Action : mise à jour du profil réseauteur
// ─────────────────────────────────────────────────────────────────

export async function updateProfilReseauteur(
  reseauteurId: string | number,
  data: ProfilFormData,
): Promise<ActionResult> {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) return { error: 'Non authentifié' }

  const parsed = ProfilSchema.safeParse(data)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { error: firstError?.message ?? 'Données invalides' }
  }

  const { noindex, reseauxFrequentes, ...profileData } = parsed.data

  try {
    // L'access.update de la collection vérifie ownership : { user: { equals: user.id } }
    // Un réseauteur ne peut donc mettre à jour que son propre profil.
    await payload.update({
      collection: 'reseauteurs',
      id: reseauteurId,
      data: {
        ...profileData,
        // Téléphone et email vides → null (ne pas partager)
        telephone: profileData.telephone || null,
        emailContact: (profileData.emailContact || null) as string | null,
        site: profileData.site || null,
        linkedin: profileData.linkedin || null,
        departement: profileData.departement || null,
        region: profileData.region || null,
        // noindex : opt-out d'indexation décidé par le réseauteur
        seo: noindex !== undefined ? { noindex } : undefined,
        // Affiliation réseaux (têtes ou groupes locaux — décision 2026-07-17)
        reseauxFrequentes: reseauxFrequentes ?? [],
      } as Record<string, unknown>,
      // Pas de overrideAccess : on laisse Payload vérifier l'ownership
    })

    revalidatePath('/dashboard/profil')
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('Unauthorized') || message.includes('access')) {
      return { error: 'Vous n\'êtes pas autorisé à modifier ce profil.' }
    }
    console.error('[action/updateProfilReseauteur]', err)
    return { error: 'Erreur lors de la mise à jour du profil.' }
  }
}

// ─────────────────────────────────────────────────────────────────
// Action : mise à jour du noindex (opt-out d'indexation)
// ─────────────────────────────────────────────────────────────────

export async function updateNoindex(
  reseauteurId: string | number,
  noindex: boolean,
): Promise<ActionResult> {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) return { error: 'Non authentifié' }

  try {
    await payload.update({
      collection: 'reseauteurs',
      id: reseauteurId,
      data: { seo: { noindex } } as Record<string, unknown>,
    })
    revalidatePath('/dashboard/profil')
    return { success: true }
  } catch (err) {
    console.error('[action/updateNoindex]', err)
    return { error: 'Erreur lors de la mise à jour.' }
  }
}

// ─────────────────────────────────────────────────────────────────
// Action : suppression du compte (RGPD)
// Délègue à /api/account/delete pour garder la logique centralisée
// ─────────────────────────────────────────────────────────────────

export async function deleteCompte(): Promise<void> {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })
  if (!user) return

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/api/account/delete`, {
      method: 'POST',
      headers: Object.fromEntries(hdrs.entries()),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? 'Erreur suppression')
    }
  } catch (err) {
    console.error('[action/deleteCompte]', err)
    throw err
  }

  redirect('/login?deleted=1')
}
