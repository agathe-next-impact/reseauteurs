'use server'

/**
 * Server action — enregistre les participations d'un réseauteur à des événements.
 *
 * Sécurité : on retrouve le réseauteur via l'utilisateur authentifié (jamais un id
 * fourni par le client). Le scope (réseau organisateur ∈ réseaux fréquentés + statut
 * publié) est garanti par le hook beforeChange de la collection reseauteurs — cette
 * action ne fait que soumettre la sélection.
 */
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { revalidatePath } from 'next/cache'

function toIds(rel: unknown): string[] {
  if (!Array.isArray(rel)) return []
  return rel
    .map((r) => (typeof r === 'object' && r !== null ? (r as { id?: unknown }).id : r))
    .filter((v) => v != null)
    .map(String)
}

export async function saveParticipations(
  eventIds: Array<number | string>,
): Promise<{ ok: boolean; count: number; error?: string }> {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })
  if (!user) return { ok: false, count: 0, error: 'Non authentifié.' }

  const { docs } = await payload.find({
    collection: 'reseauteurs',
    where: { user: { equals: user.id } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const reseauteur = docs[0]
  if (!reseauteur) return { ok: false, count: 0, error: 'Profil réseauteur introuvable.' }

  const oldIds = toIds(reseauteur.evenementsParticipes)
  const normalized = eventIds.map((v) => Number(v)).filter((n) => Number.isFinite(n))

  let updated
  try {
    updated = await payload.update({
      collection: 'reseauteurs',
      id: reseauteur.id,
      data: { evenementsParticipes: normalized } as Record<string, unknown>,
      overrideAccess: true,
    })
  } catch (err) {
    console.error('[participations] update failed:', err)
    return { ok: false, count: 0, error: 'Erreur lors de l\'enregistrement.' }
  }

  // Revalidation ISR : fiche réseauteur + fiches événements (union ancien/nouveau état).
  const newIds = toIds((updated as { evenementsParticipes?: unknown }).evenementsParticipes)
  if ((updated as { slug?: string }).slug) {
    revalidatePath(`/reseauteur/${(updated as { slug?: string }).slug}`)
  }
  const unionIds = [...new Set([...oldIds, ...newIds])].map(Number).filter(Number.isFinite)
  if (unionIds.length > 0) {
    const { docs: evs } = await payload.find({
      collection: 'evenements',
      where: { id: { in: unionIds } },
      select: { slug: true } as Record<string, boolean>,
      depth: 0,
      limit: 300,
      overrideAccess: true,
    })
    for (const ev of evs) {
      if (ev.slug) revalidatePath(`/evenement/${ev.slug}`)
    }
  }

  return { ok: true, count: newIds.length }
}
