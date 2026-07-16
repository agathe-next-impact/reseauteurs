'use server'

/**
 * Server action — déclaration des groupes administrés par un réseauteur Plus
 * (décision 2026-07-16). La mutation passe par l'API locale Payload AVEC
 * l'utilisateur courant (overrideAccess: false) : les hooks de la collection
 * appliquent les règles (Plus actif, 3 groupes max, locaux uniquement) —
 * jamais confiance au client.
 */
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { revalidatePath } from 'next/cache'

type ActionResult = { ok: true } | { ok: false; error: string }

export async function saveAdminReseaux(reseauIds: number[]): Promise<ActionResult> {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })
  if (!user) return { ok: false, error: 'Non authentifié.' }

  const ids = [...new Set(reseauIds.map(Number))].filter((n) => Number.isInteger(n) && n > 0)

  const { docs } = await payload.find({
    collection: 'reseauteurs',
    where: { user: { equals: user.id } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const profil = docs[0]
  if (!profil) return { ok: false, error: 'Profil réseauteur introuvable.' }

  const avant = (Array.isArray(profil.adminReseaux) ? profil.adminReseaux : [])
    .map((r) => Number(typeof r === 'object' && r !== null ? (r as { id?: unknown }).id : r))
    .filter(Number.isFinite)

  try {
    await payload.update({
      collection: 'reseauteurs',
      id: profil.id,
      data: { adminReseaux: ids } as never,
      user,
      overrideAccess: false,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message.replace(/^ValidationError:?\s*/i, '') : 'Erreur lors de l\'enregistrement.'
    return { ok: false, error: msg }
  }

  // Revalide les fiches des groupes affectés (section « Admins du groupe » — ISR)
  const affectes = [...new Set([...avant, ...ids])]
  if (affectes.length > 0) {
    const { docs: reseaux } = await payload.find({
      collection: 'reseaux',
      where: { id: { in: affectes } },
      depth: 0,
      limit: 10,
      overrideAccess: true,
      select: { slug: true } as Record<string, boolean>,
    })
    for (const r of reseaux) {
      const s = (r as { slug?: string | null }).slug
      if (s) {
        try {
          revalidatePath(`/reseau/${s}`)
        } catch { /* hors contexte */ }
      }
    }
  }
  return { ok: true }
}
