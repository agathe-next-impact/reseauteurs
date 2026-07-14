/**
 * lib/acces-plus.ts — Helpers centralisés du palier « Réseauteur Plus » (ADR-0013, P1.4).
 *
 * Source unique de vérité pour le **statut Plus** d'un utilisateur (`estPlus`).
 * Le gate de création d'événement lui-même vit dans le hook beforeValidate de
 * `Evenements.ts` (il entrelace l'invariant XOR, l'ownership et l'abonnement) et
 * réutilise `estPlus` pour la branche réseauteur.
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
