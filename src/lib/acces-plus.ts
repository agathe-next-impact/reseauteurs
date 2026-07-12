/**
 * lib/acces-plus.ts — Helpers centralisés du palier « Réseauteur Plus » (ADR-0013, P1.4).
 *
 * Source unique de vérité pour :
 *   - Statut Plus d'un utilisateur (estPlus)
 *   - Gate de création d'événement (peutCreerEvenementAsync)
 *
 * Le statut Plus (`users.plusActif` / `plusExpireAt` / `plusSource`) est posé par le
 * webhook Stripe (abonnement) ou par la route d'activation de licence (P2.A) —
 * JAMAIS par le client (invariant ADR-0011/0013). Tous les guards métier appellent
 * ces fonctions — jamais la valeur client.
 *
 * Même convention de typage que lib/reseau-hierarchie.ts : interfaces minimales,
 * indépendantes de payload-types.
 */

// ─────────────────────────────────────────────
// TYPES MINIMAUX
// ─────────────────────────────────────────────

export interface UserForPlus {
  id: string | number
  role?: string | null
  plusActif?: boolean | null
  plusExpireAt?: string | null
}

/** Interface minimale de Payload Local API pour les helpers async */
interface PayloadMinimal {
  findByID: (args: {
    collection: string
    id: string | number
    depth?: number
    overrideAccess?: boolean
  }) => Promise<Record<string, unknown>>
  find: (args: {
    collection: string
    where?: Record<string, unknown>
    limit?: number
    overrideAccess?: boolean
    depth?: number
  }) => Promise<{ docs: Array<Record<string, unknown>>; totalDocs: number }>
}

// ─────────────────────────────────────────────
// HELPERS SYNCHRONES
// ─────────────────────────────────────────────

/**
 * `true` si l'utilisateur est Réseauteur Plus ACTIF :
 * `plusActif === true` ET (pas d'expiration OU expiration future).
 *
 * ⚠️ À appeler sur un user FRAIS (findByID) — jamais sur le JWT (peut être périmé).
 */
export function estPlus(user: UserForPlus | null | undefined): boolean {
  if (!user || user.plusActif !== true) return false
  if (!user.plusExpireAt) return true
  const exp = new Date(user.plusExpireAt)
  return !Number.isNaN(exp.getTime()) && exp.getTime() > Date.now()
}

// ─────────────────────────────────────────────
// HELPERS ASYNC (requièrent req.payload)
// ─────────────────────────────────────────────

/**
 * Gate de création d'événement (ADR-0013 §2) — évalué côté serveur :
 *   - admin        → toujours autorisé ;
 *   - organisateur → autorisé (le hook Evenements vérifie ensuite l'ownership du
 *                    réseau + l'abonnement du national effectif — reseau-hierarchie.ts) ;
 *   - reseauteur   → autorisé ssi Réseauteur Plus actif (lecture fraîche du user).
 *
 * Retourne { autorise } ou { autorise: false, raison } (message FR affichable).
 */
export async function peutCreerEvenementAsync(
  userId: string | number,
  payload: PayloadMinimal,
): Promise<{ autorise: boolean; raison?: string }> {
  const user = (await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 0,
    overrideAccess: true,
  })) as unknown as UserForPlus & { role?: string | null }

  if (!user) return { autorise: false, raison: 'Utilisateur introuvable.' }
  if (user.role === 'admin' || user.role === 'organisateur') return { autorise: true }

  if (user.role === 'reseauteur') {
    if (estPlus(user)) return { autorise: true }
    return {
      autorise: false,
      raison:
        'La création d\'événements est réservée aux réseauteurs Plus. ' +
        'Passez Plus depuis votre tableau de bord (abonnement ou code partenaire).',
    }
  }

  return { autorise: false, raison: 'Ce type de compte ne peut pas créer d\'événements.' }
}
