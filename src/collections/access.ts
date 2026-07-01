/**
 * access.ts — Fonctions d'accès et helpers partagés (ADR-0011).
 *
 * Modèle à 3 rôles : reseauteur / organisateur / admin.
 * Les fonctions dépréciées (plan 3-paliers) sont conservées pour ne pas
 * casser le code existant — accounts-and-billing les supprimera en J2.A.
 */

import type { FieldAccess, PayloadRequest } from 'payload'

/**
 * Récupère l'utilisateur frais depuis la DB (caché par requête).
 * Évite les données JWT périmées dans les vérifications d'accès par champ.
 * Pattern conservé tel quel — excellent anti-N+1 (AUDIT-DELTA §4).
 */
async function getFreshUser(req: PayloadRequest) {
  if (!req.user) return null
  const reqAny = req as unknown as Record<string, unknown>
  const cached = reqAny._freshUser as typeof req.user | undefined
  if (cached) return cached
  const fresh = await req.payload.findByID({
    collection: 'users',
    id: req.user.id,
    overrideAccess: true,
  })
  reqAny._freshUser = fresh
  return fresh
}

// ─────────────────────────────────────────────
// HELPERS ADR-0011 (modèle 3 rôles B2B)
// ─────────────────────────────────────────────

export const isAdmin: FieldAccess = ({ req: { user } }) => user?.role === 'admin'

export const isOrganisateur: FieldAccess = ({ req: { user } }) =>
  user?.role === 'organisateur' || user?.role === 'admin'

export const isReseauteur: FieldAccess = ({ req: { user } }) => !!user

/**
 * Garde "1 user = au plus 1 réseau NATIONAL" (ADR-0012 E1.2).
 * Remplace l'ancienne garde "1 user = 1 réseau" de l'ADR-0003.
 *
 * - Admin : illimité.
 * - Organisateur : peut posséder au plus 1 réseau de niveau 'national'.
 *   (Il peut posséder N locaux : pas d'unicité sur local.user.)
 * - Un réseauteur n'agit que sur son profil — jamais de réseau.
 *
 * L'index partiel unique WHERE niveau='national' en base renforce cette règle côté DB.
 */
export async function canCreateNational(req: PayloadRequest): Promise<boolean> {
  const user = await getFreshUser(req)
  if (!user) return false
  if (user.role === 'admin') return true
  if (user.role !== 'organisateur') return false
  const { totalDocs } = await req.payload.count({
    collection: 'reseaux',
    where: {
      and: [
        { user: { equals: user.id } },
        { niveau: { equals: 'national' } },
      ],
    },
    overrideAccess: true,
  })
  return totalDocs === 0
}

/**
 * @deprecated Utiliser `canCreateNational` (ADR-0012 E1.2).
 * Conservé comme alias pour ne pas casser les imports existants pendant la transition.
 * Délègue à `canCreateNational` — comportement identique pour les nationaux.
 */
export async function canCreateReseau(req: PayloadRequest): Promise<boolean> {
  return canCreateNational(req)
}

/**
 * Garde "1 user reseauteur = 1 reseauteur".
 */
export async function canCreateReseauteur(req: PayloadRequest): Promise<boolean> {
  const user = await getFreshUser(req)
  if (!user) return false
  if (user.role === 'admin') return true
  const { totalDocs } = await req.payload.count({
    collection: 'reseauteurs',
    where: { user: { equals: user.id } },
    overrideAccess: true,
  })
  return totalDocs === 0
}

// ─────────────────────────────────────────────
// DÉPRÉCIÉES — conservées pour compatibilité transitoire
// (accounts-and-billing supprime J2.A)
// ─────────────────────────────────────────────

/**
 * @deprecated ADR-0011 : modèle 3 paliers supprimé.
 * Conservé pour que les imports dans le code legacy (Fournisseurs, etc.)
 * compilent sans erreur pendant la transition.
 * Retourne toujours 'acces' (accès de base) sauf admin → 'premium'.
 */
export function getEffectiveFeatureLevel(user: {
  role?: string | null
  plan?: string | null
  planExpiresAt?: string | null
}): 'acces' | 'developpement' | 'premium' {
  if (user.role === 'admin') return 'premium'
  // Compatibilité avec l'ancien modèle : si plan est encore présent en DB,
  // on le respecte; sinon, on retourne 'acces' (niveau de base)
  const plan = user.plan as string | null | undefined
  if (plan === 'developpement' || plan === 'premium') return plan as 'developpement' | 'premium'
  return 'acces'
}

/** @deprecated Alias de getEffectiveFeatureLevel. */
export const getEffectivePlan = getEffectiveFeatureLevel

/** @deprecated Utiliser isOrganisateur ou isAdmin. */
export const isDeveloppementOrAbove: FieldAccess = async ({ req }) => {
  const user = await getFreshUser(req)
  if (!user) return false
  return user.role === 'admin' || user.role === 'organisateur'
}

/** @deprecated Plan premium supprimé (ADR-0011). Alias de isAdmin pour compatibilité. */
export const isPremium: FieldAccess = async ({ req }) => {
  const user = await getFreshUser(req)
  if (!user) return false
  return user.role === 'admin'
}

/** @deprecated Alias de isPremium. */
export const isPremiumOrAbove: FieldAccess = isPremium

/** @deprecated Alias de isPremium. */
export const isInfinite: FieldAccess = isPremium

/** @deprecated Remplacée par canCreateReseau. */
export async function canCreateFiche(req: PayloadRequest): Promise<boolean> {
  return canCreateReseau(req)
}

/** @deprecated Supprimée (ADR-0003). */
export async function canCreateOrganisateurFiche(_req: PayloadRequest): Promise<boolean> {
  return false
}
