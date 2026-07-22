/**
 * revendication-reseau.ts — Revendication d'une fiche de tête de réseau orpheline.
 *
 * Contexte : l'annuaire est seedé avec ~200 réseaux nationaux « nom seul »
 * (`seed-reseaux-nationaux.ts`) — publiés, sans compte propriétaire (`user` null,
 * `source: 'importe'`). Ces fiches doivent pouvoir être revendiquées depuis le front,
 * par un nouvel utilisateur (à l'inscription) comme par un utilisateur déjà connecté.
 *
 * Source unique de vérité des deux questions :
 *   1. cette fiche est-elle revendicable ?          → `chargerReseauRevendicable`
 *   2. ce compte a-t-il le droit de revendiquer ?   → `eligibiliteCompte`
 *
 * L'écriture elle-même (`revendiquerPour`) est RACE-SAFE : la mise à jour est
 * conditionnée à `user: { exists: false }`, donc deux revendications simultanées
 * ne peuvent pas aboutir toutes les deux — c'est le même garde que le claim à
 * l'inscription (hook afterChange de Users, `req.context.claimReseauId`).
 *
 * Invariant ADR-0014 préservé : on ne touche PAS au `statut` de la fiche. Une fiche
 * importée déjà publiée le reste après revendication (« fiches importées épargnées ») ;
 * seul `source` passe à 'revendique', ce qui la rend désormais sujette à la
 * dépublication par le webhook/cron en cas d'expiration d'abonnement.
 */
import type { Payload } from 'payload'

export interface ReseauRevendicable {
  id: number | string
  nom: string
  slug: string | null
  ville: string | null
}

export type ResultatFiche =
  | { ok: true; reseau: ReseauRevendicable }
  | { ok: false; error: string }

export type ResultatCompte =
  | { ok: true }
  | { ok: false; error: string }

/** Compte minimal nécessaire aux contrôles (toujours lu FRAIS, jamais le JWT). */
export interface CompteRevendiquant {
  id: number | string
  role?: string | null
}

/** Extrait l'id d'une relation Payload, peuplée ou non. */
function relationId(rel: unknown): number | string | null {
  if (rel === null || rel === undefined) return null
  if (typeof rel === 'object') return (rel as { id?: number | string }).id ?? null
  return rel as number | string
}

/**
 * Charge une fiche et vérifie qu'elle est revendicable.
 *
 * Conditions cumulatives :
 *   - la fiche existe ;
 *   - c'est une TÊTE de réseau (`niveau !== 'local'`) — les groupes locaux se gèrent
 *     par affiliation, pas par revendication ;
 *   - elle est publiée (une fiche suspendue n'est pas exposée au public) ;
 *   - elle n'a pas déjà de compte propriétaire.
 */
export async function chargerReseauRevendicable(
  payload: Payload,
  reseauId: number | string,
): Promise<ResultatFiche> {
  let doc: Record<string, unknown> | null = null
  try {
    doc = (await payload.findByID({
      collection: 'reseaux',
      id: reseauId,
      depth: 0,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
  } catch {
    doc = null
  }
  if (!doc) return { ok: false, error: 'Ce réseau est introuvable.' }

  if (doc.niveau === 'local') {
    return {
      ok: false,
      error:
        'Ce réseau est un groupe local : il se rattache à une tête de réseau, il ne se revendique pas.',
    }
  }
  if (doc.statut !== 'publiee') {
    return { ok: false, error: 'Cette fiche n\'est pas disponible.' }
  }
  if (relationId(doc.user) != null) {
    return { ok: false, error: 'Ce réseau est déjà géré par un compte.' }
  }

  return {
    ok: true,
    reseau: {
      id: doc.id as number | string,
      nom: String(doc.nom ?? ''),
      slug: (doc.slug as string | null) ?? null,
      ville: (doc.ville as string | null) ?? null,
    },
  }
}

/**
 * Vérifie qu'un compte EXISTANT peut revendiquer une tête de réseau.
 *
 * Règles (volontairement strictes — revendiquer, c'est prendre le contrôle d'une
 * fiche publique) :
 *   - admin : toujours autorisé ;
 *   - organisateur SANS tête de réseau : autorisé (c'est le cas nominal) ;
 *   - organisateur possédant DÉJÀ une tête : refusé — invariant « 1 tête par compte »
 *     (cf. `canCreateNational`). Fusionner deux fiches est une opération admin ;
 *   - réseauteur / partenaire : refusé. Passer organisateur est un changement de
 *     rôle, donc d'autorisations : il n'est pas accordé automatiquement depuis une
 *     page publique.
 */
export async function eligibiliteCompte(
  payload: Payload,
  user: CompteRevendiquant,
): Promise<ResultatCompte> {
  if (user.role === 'admin') return { ok: true }

  if (user.role !== 'organisateur') {
    return {
      ok: false,
      error:
        'Seul un compte organisateur peut gérer un réseau. Votre compte actuel ne permet pas de revendiquer cette fiche — créez un compte organisateur ou contactez-nous.',
    }
  }

  const { totalDocs } = await payload.count({
    collection: 'reseaux',
    where: {
      and: [{ user: { equals: user.id } }, { niveau: { not_equals: 'local' } }],
    },
    overrideAccess: true,
  })
  if (totalDocs > 0) {
    return {
      ok: false,
      error:
        'Votre compte gère déjà un réseau. Un compte ne peut piloter qu\'une seule tête de réseau — contactez-nous pour un rattachement.',
    }
  }

  return { ok: true }
}

/**
 * Consomme la revendication mise en attente d'un compte, APRÈS vérification de son
 * email (décision 2026-07-22). C'est le seul moment où une fiche change de mains via
 * le parcours d'inscription : tant que l'email n'est pas vérifié, aucune fiche n'est
 * immobilisée par un compte qui ne pourra jamais se connecter.
 *
 * Le champ `pendingClaimReseauId` est vidé dans TOUS les cas — succès comme échec :
 * une revendication perdue (fiche prise entre-temps) ne doit pas être retentée
 * indéfiniment à chaque passage.
 *
 * Repli : si la revendication échoue, on crée le réseau national que l'inscription
 * aurait créé sans revendication (même forme que le hook afterChange de Users —
 * `statut: 'suspendue'`, publié par le webhook Stripe uniquement, ADR-0014). Sans ce
 * repli, un organisateur se retrouverait avec un compte sans aucun réseau.
 *
 * Ne jette jamais : la vérification d'email doit aboutir même si cette étape échoue.
 */
export async function resoudreClaimEnAttente(
  payload: Payload,
  user: { id: number | string; role?: string | null; nomSociete?: string | null; ville?: string | null },
): Promise<void> {
  try {
    const frais = (await payload.findByID({
      collection: 'users',
      id: user.id,
      depth: 0,
      overrideAccess: true,
      showHiddenFields: true,
    })) as unknown as Record<string, unknown>

    const enAttente = frais?.pendingClaimReseauId
    const claimId = enAttente != null ? Number(enAttente) : NaN
    if (!Number.isInteger(claimId) || claimId <= 0) return

    // Toujours purger le marqueur, quelle que soit l'issue.
    const purger = async () => {
      try {
        await payload.update({
          collection: 'users',
          id: user.id,
          data: { pendingClaimReseauId: null } as never,
          context: { webhookTrusted: true },
          overrideAccess: true,
        })
      } catch (err) {
        console.error('[resoudreClaimEnAttente] purge du marqueur impossible:', err)
      }
    }

    // Un compte qui possède déjà une tête ne revendique pas (invariant 1 tête/compte).
    const eligible = await eligibiliteCompte(payload, {
      id: user.id,
      role: (frais.role as string | null) ?? user.role ?? null,
    })

    let revendique = false
    if (eligible.ok) {
      const fiche = await chargerReseauRevendicable(payload, claimId)
      if (fiche.ok) {
        const res = await revendiquerPour(payload, fiche.reseau.id, user.id)
        revendique = res.ok
        if (!res.ok) {
          console.warn(
            `[resoudreClaimEnAttente] revendication perdue pour le réseau ${claimId}: ${res.error}`,
          )
        }
      } else {
        console.warn(
          `[resoudreClaimEnAttente] fiche ${claimId} non revendicable: ${fiche.error}`,
        )
      }
    }

    await purger()

    if (revendique) return

    // Repli : aucun réseau rattaché → on crée celui de l'inscription classique.
    const { totalDocs } = await payload.count({
      collection: 'reseaux',
      where: { user: { equals: user.id } },
      overrideAccess: true,
    })
    if (totalDocs > 0) return

    await payload.create({
      collection: 'reseaux',
      data: {
        user: user.id,
        nom: (frais.nomSociete as string | null) ?? user.nomSociete ?? 'Mon réseau',
        ville: (frais.ville as string | null) ?? user.ville ?? undefined,
        niveau: 'national',
        statut: 'suspendue', // ADR-0014 : publiée par le webhook Stripe uniquement
        source: 'revendique',
      } as never,
      overrideAccess: true,
    })
  } catch (err) {
    // La vérification d'email reste un succès — on ne la compromet pas.
    console.error('[resoudreClaimEnAttente] échec:', err)
  }
}

/**
 * Attribue la fiche au compte, de façon atomique.
 *
 * Le `where` sur `user: { exists: false }` est le garde anti-course : si une autre
 * revendication est passée entre-temps, `updated` est vide et on renvoie une erreur
 * explicite plutôt que d'écraser le propriétaire légitime.
 *
 * `statut` n'est délibérément pas touché (cf. invariant ADR-0014 en tête de fichier).
 */
export async function revendiquerPour(
  payload: Payload,
  reseauId: number | string,
  userId: number | string,
): Promise<ResultatCompte> {
  try {
    const { docs: updated } = await payload.update({
      collection: 'reseaux',
      where: {
        and: [{ id: { equals: reseauId } }, { user: { exists: false } }],
      },
      data: { user: userId, source: 'revendique' } as never,
      overrideAccess: true,
    })
    if (updated.length === 0) {
      return { ok: false, error: 'Ce réseau vient d\'être revendiqué par un autre compte.' }
    }
    return { ok: true }
  } catch (err) {
    console.error('[revendiquerPour] échec:', err)
    return { ok: false, error: 'La revendication a échoué. Réessayez.' }
  }
}
