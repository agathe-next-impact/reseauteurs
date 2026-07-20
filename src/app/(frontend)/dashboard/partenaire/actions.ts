'use server'

/**
 * Server action — met à jour la fiche partenaire (nom, lien, description) et son offre.
 * Sécurité : on retrouve le partenaire via l'utilisateur authentifié. Les champs
 * statut/stripe ne sont jamais soumis ici (posés par le webhook Stripe).
 */
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { revalidatePath } from 'next/cache'

export interface PartenaireFormData {
  nom: string
  lien?: string
  emailContact?: string
  telephone?: string
  description?: string
  offreTitre?: string
  offreDescription?: string
  offreLien?: string
}

export async function updatePartenaire(
  data: PartenaireFormData,
): Promise<{ ok: boolean; error?: string }> {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })
  if (!user) return { ok: false, error: 'Non authentifié.' }

  const { docs } = await payload.find({
    collection: 'partenaires',
    where: { user: { equals: user.id } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const partenaire = docs[0]
  if (!partenaire) return { ok: false, error: 'Fiche partenaire introuvable.' }

  const nom = (data.nom ?? '').trim()
  if (!nom) return { ok: false, error: 'Le nom de l\'entreprise est obligatoire.' }

  const emailContact = (data.emailContact ?? '').trim()
  if (emailContact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailContact)) {
    return { ok: false, error: 'Email de contact invalide.' }
  }

  try {
    const updated = await payload.update({
      collection: 'partenaires',
      id: partenaire.id,
      data: {
        nom,
        lien: (data.lien ?? '').trim() || null,
        emailContact: emailContact || null,
        telephone: (data.telephone ?? '').trim() || null,
        description: (data.description ?? '').trim() || null,
        offre: {
          titre: (data.offreTitre ?? '').trim() || null,
          description: (data.offreDescription ?? '').trim() || null,
          lien: (data.offreLien ?? '').trim() || null,
        },
      } as Record<string, unknown>,
      overrideAccess: true,
    })
    const slug = (updated as { slug?: string }).slug
    if (slug) revalidatePath(`/partenaire/${slug}`)
    revalidatePath('/partenaires')
    revalidatePath('/dashboard/offres')
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement.'
    console.error('[partenaire] update failed:', err)
    return { ok: false, error: msg }
  }
}
