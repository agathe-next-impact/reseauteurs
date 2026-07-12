/**
 * lib/affiliation.ts — Lien partenaire ⇄ réseauteur (ADR-0013).
 *
 * L'affiliation est matérialisée par une LICENCE Plus activée : un réseauteur qui
 * saisit le code promo d'un pack devient « affilié » au partenaire propriétaire du
 * pack. Source de vérité = la table de traçabilité `licences-activations`
 * (activation → pack → partenaire), jamais un flag client.
 *
 *   Partenaire ──(packs)──▶ licences-activations ──(user)──▶ Réseauteur
 *
 * Deux sens :
 *   - getReseauteursAffilies(partenaireId)  → fiche partenaire : « ses réseauteurs »
 *   - getPartenaireDeReseauteur(userId)     → fiche réseauteur : « son partenaire »
 *
 * Requêtes en deux temps (pack IDs → activations) plutôt qu'un filtre imbriqué,
 * pour rester robuste et lisible. Lecture serveur (overrideAccess) — données publiques.
 */
import type { Payload } from 'payload'

export interface PartenaireLien {
  id: number
  nom: string
  slug: string | null
}

export interface ReseauteurAffilie {
  id: number
  slug: string | null
  prenom: string
  nom: string
  fonction: string | null
  ville: string | null
  photoUrl: string | null
  badge: string | null
}

function relId(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'object') {
    const id = (v as { id?: unknown }).id
    return typeof id === 'number' ? id : id != null ? Number(id) : null
  }
  return Number(v)
}

/**
 * Réseauteurs affiliés à un partenaire (ceux qui ont activé une licence de ses packs).
 * Filtré aux profils publics (statut « valide ») pour l'affichage sur la fiche publique.
 */
export async function getReseauteursAffilies(
  payload: Payload,
  partenaireId: number | string,
  limit = 60,
): Promise<ReseauteurAffilie[]> {
  const { docs: packs } = await payload.find({
    collection: 'licences-packs',
    where: { partenaire: { equals: Number(partenaireId) } },
    depth: 0,
    limit: 100,
    overrideAccess: true,
  })
  const packIds = packs.map((p) => p.id as number)
  if (packIds.length === 0) return []

  const { docs: activations } = await payload.find({
    collection: 'licences-activations',
    where: { pack: { in: packIds } },
    depth: 0,
    limit: 1000,
    overrideAccess: true,
  })
  const userIds = [
    ...new Set(activations.map((a) => relId((a as { user?: unknown }).user)).filter((v): v is number => v != null)),
  ]
  if (userIds.length === 0) return []

  const { docs } = await payload.find({
    collection: 'reseauteurs',
    where: { and: [{ user: { in: userIds } }, { statut: { equals: 'valide' } }] },
    depth: 1,
    limit,
    sort: 'nom',
    overrideAccess: true,
  })

  return docs.map((r) => {
    const photo = (r as { photo?: unknown }).photo
    const photoUrl =
      photo && typeof photo === 'object'
        ? ((photo as { sizes?: { thumbnail?: { url?: string | null } }; url?: string | null }).sizes?.thumbnail?.url ??
            (photo as { url?: string | null }).url ??
            null)
        : null
    return {
      id: r.id as number,
      slug: (r.slug as string | null) ?? null,
      prenom: (r.prenom as string) ?? '',
      nom: (r.nom as string) ?? '',
      fonction: (r.fonction as string | null) ?? null,
      ville: (r.ville as string | null) ?? null,
      photoUrl,
      badge: (r.badge as string | null) ?? null,
    }
  })
}

/**
 * Partenaire d'appartenance d'un réseauteur (via sa licence Plus activée).
 * Ne renvoie le lien QUE si le partenaire est encore actif (fiche publique visible).
 */
export async function getPartenaireDeReseauteur(
  payload: Payload,
  userId: number | string,
): Promise<PartenaireLien | null> {
  const { docs } = await payload.find({
    collection: 'licences-activations',
    where: { user: { equals: Number(userId) } },
    depth: 2, // activation → pack → partenaire
    limit: 1,
    overrideAccess: true,
  })
  const act = docs[0]
  if (!act) return null

  const pack = (act as { pack?: unknown }).pack
  if (!pack || typeof pack !== 'object') return null
  const partenaire = (pack as { partenaire?: unknown }).partenaire
  if (!partenaire || typeof partenaire !== 'object') return null

  const p = partenaire as { id: number; nom?: string | null; slug?: string | null; statut?: string | null }
  if (p.statut !== 'actif') return null
  return { id: p.id, nom: p.nom ?? '', slug: p.slug ?? null }
}
