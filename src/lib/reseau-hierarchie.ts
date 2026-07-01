/**
 * lib/reseau-hierarchie.ts — Helpers centralisés pour la hiérarchie réseaux national↔local (ADR-0012 E1.2).
 *
 * Source unique de vérité pour :
 *   - Résolution du national effectif d'un réseau (nationalDe)
 *   - Statut d'abonnement (abonnementActif)
 *   - Gate de publication d'événement (peutPublierEvenement)
 *   - Gate de création de local (peutCreerLocalAsync)
 *   - Ownership / umbrella (peutGererReseau, peutGererEvenement)
 *
 * Remplace le test direct `if (!reseau.partenaire) throw` de l'ADR-0011.
 * Tous les guards métier appellent ces fonctions — jamais la valeur client.
 *
 * Convention de typage :
 *   Les helpers synchrones utilisent des interfaces locales (pas d'import payload-types)
 *   pour rester indépendants du cycle generate:types.
 *   Les helpers async acceptent un `payload: PayloadMinimal` pour les requêtes DB.
 */

// ─────────────────────────────────────────────
// TYPES MINIMAUX (indépendants de payload-types)
// ─────────────────────────────────────────────

export interface ReseauForHierarchy {
  id: string | number
  niveau?: 'national' | 'local' | null
  /** Populé (depth >= 1) si c'est un local, sinon ID ou null */
  parent?: ReseauForHierarchy | string | number | null
  partenaire?: boolean | null
  palier?: string | null
  user?: { id: string | number } | string | number | null
}

export interface UserForHierarchy {
  id: string | number
  role?: string | null
}

export interface EvenementForHierarchy {
  reseau?: ReseauForHierarchy | string | number | null
}

/** Interface minimale de Payload Local API pour les helpers async */
interface PayloadMinimal {
  find: (args: {
    collection: string
    where?: Record<string, unknown>
    limit?: number
    overrideAccess?: boolean
    depth?: number
  }) => Promise<{ docs: Array<Record<string, unknown>>; totalDocs: number }>
  count: (args: {
    collection: string
    where?: Record<string, unknown>
    overrideAccess?: boolean
  }) => Promise<{ totalDocs: number }>
}

// ─────────────────────────────────────────────
// HELPERS SYNCHRONES (niveau/parent déjà populé)
// ─────────────────────────────────────────────

/**
 * Résout le réseau national depuis n'importe quel niveau.
 * - Si `national` : retourne le réseau lui-même.
 * - Si `local` : retourne le parent (requis populé depth >= 1).
 * - Si niveau absent (données historiques) : considère comme national.
 *
 * Retourne `null` si le parent n'est pas populé (ID seul) → appelant doit gérer.
 */
export function nationalDe(reseau: ReseauForHierarchy): ReseauForHierarchy | null {
  if (!reseau) return null
  if (reseau.niveau === 'national' || reseau.niveau == null) return reseau
  if (reseau.niveau === 'local') {
    const parent = reseau.parent
    if (parent == null || typeof parent === 'string' || typeof parent === 'number') {
      // Parent non populé : on ne peut pas résoudre le national
      return null
    }
    return parent as ReseauForHierarchy
  }
  return reseau
}

/**
 * Retourne `true` si l'abonnement du national effectif est actif.
 * Source de vérité : champ `partenaire` posé par webhook Stripe.
 * Ne déduit JAMAIS du client (invariant ADR-0011/0012).
 */
export function abonnementActif(reseau: ReseauForHierarchy): boolean {
  const national = nationalDe(reseau)
  return national?.partenaire === true
}

/**
 * Un réseau peut publier des événements ssi son national est abonné.
 * Remplace `if (!reseau.partenaire) throw` (ADR-0012 §4).
 * Requiert que `reseau.parent` soit populé si `niveau === 'local'` (depth >= 1).
 */
export function peutPublierEvenement(reseau: ReseauForHierarchy): boolean {
  return abonnementActif(reseau)
}

/**
 * Vérifie si un utilisateur peut gérer un réseau.
 * Trois cas autorisés (ADR-0012 §5) :
 *   1. Admin : accès total.
 *   2. Propriétaire direct (national ou local dont user === userId).
 *   3. Umbrella : user possède le national parent du local (Q8 — le national garde la main).
 *
 * Requiert que `reseau.parent` soit populé si `niveau === 'local'` (depth >= 1).
 */
export function peutGererReseau(
  user: UserForHierarchy,
  reseau: ReseauForHierarchy,
): boolean {
  if (user.role === 'admin') return true

  const resolveId = (rel: unknown): string | number | null => {
    if (rel == null) return null
    if (typeof rel === 'object') return (rel as { id?: string | number }).id ?? null
    return rel as string | number
  }

  // Propriétaire direct
  const reseauUserId = resolveId(reseau.user)
  if (reseauUserId != null && String(reseauUserId) === String(user.id)) return true

  // Umbrella : le national gère ses locaux même délégués (ADR-0012 Q8)
  if (reseau.niveau === 'local' && reseau.parent && typeof reseau.parent === 'object') {
    const parent = reseau.parent as ReseauForHierarchy
    const parentUserId = resolveId(parent.user)
    if (parentUserId != null && String(parentUserId) === String(user.id)) return true
  }

  return false
}

/**
 * Vérifie si un utilisateur peut gérer un événement.
 * Délègue à `peutGererReseau` sur le réseau organisateur.
 * Requiert que `evenement.reseau` soit populé (depth >= 1, parent populé si local).
 */
export function peutGererEvenement(
  user: UserForHierarchy,
  evenement: EvenementForHierarchy,
): boolean {
  if (user.role === 'admin') return true
  if (!evenement.reseau || typeof evenement.reseau === 'string' || typeof evenement.reseau === 'number') {
    // Réseau non populé : on ne peut pas vérifier → refus par défaut
    return false
  }
  return peutGererReseau(user, evenement.reseau as ReseauForHierarchy)
}

// ─────────────────────────────────────────────
// CONFIG PALIERS
// ⚠️ TODO : seuils et prix RÉELS à fournir par le product owner AVANT E2.A (accounts-and-billing).
//   Ces valeurs sont des PLACEHOLDERS non contractuels.
//   Les niveaux de palier correspondent aux options du champ `reseaux.palier`.
// ─────────────────────────────────────────────

/**
 * Configuration des paliers d'abonnement national.
 * Indexés sur le nombre maximum de réseaux locaux autorisés.
 *
 * TODO (avant E2.A) : remplacer par les valeurs définitives approuvées par le product owner.
 */
export const PALIERS_CONFIG: Record<string, { maxLocaux: number; label: string }> = {
  starter:    { maxLocaux: 5,   label: 'Starter — jusqu\'à 5 locaux (TODO prix réel)' },
  growth:     { maxLocaux: 25,  label: 'Growth — jusqu\'à 25 locaux (TODO prix réel)' },
  enterprise: { maxLocaux: 999, label: 'Enterprise — locaux illimités (TODO prix réel)' },
}

const PALIER_DEFAUT = 'starter'

/**
 * Retourne le nombre maximum de réseaux locaux pour un palier donné.
 * Fallback sur 'starter' si le palier est inconnu ou absent.
 */
export function maxLocaux(palier: string | null | undefined): number {
  if (!palier) return PALIERS_CONFIG[PALIER_DEFAUT].maxLocaux
  return PALIERS_CONFIG[palier]?.maxLocaux ?? PALIERS_CONFIG[PALIER_DEFAUT].maxLocaux
}

/**
 * Options de paliers pour le champ select Payload (collection Reseaux).
 */
export const PALIERS_OPTIONS = Object.entries(PALIERS_CONFIG).map(([value, cfg]) => ({
  label: cfg.label,
  value,
}))

// ─────────────────────────────────────────────
// HELPERS ASYNC (requièrent req.payload)
// ─────────────────────────────────────────────

/**
 * Vérifie si un user peut créer un réseau local (ADR-0012 E1.2).
 *
 * Conditions :
 *   1. Possède un réseau national (niveau = 'national').
 *   2. Ce national est abonné (partenaire === true).
 *   3. Nombre de locaux existants < maxLocaux(national.palier).
 *
 * Retourne { autorise: true } ou { autorise: false, raison: string }.
 *
 * @param userId  ID de l'utilisateur créant le local.
 * @param payload Payload Local API (req.payload depuis un hook).
 */
export async function peutCreerLocalAsync(
  userId: string | number,
  payload: PayloadMinimal,
): Promise<{ autorise: boolean; raison?: string }> {
  // 1. Cherche le réseau national de cet user
  const { docs: nationaux } = await payload.find({
    collection: 'reseaux',
    where: {
      and: [
        { user: { equals: userId } },
        { niveau: { equals: 'national' } },
      ],
    },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })

  const national = nationaux[0] as (ReseauForHierarchy & Record<string, unknown>) | undefined
  if (!national) {
    return {
      autorise: false,
      raison: 'Vous ne possédez pas de réseau national. Créez d\'abord un réseau national avant d\'y rattacher des locaux.',
    }
  }

  if (!national.partenaire) {
    return {
      autorise: false,
      raison: 'Votre réseau national doit disposer d\'un abonnement actif pour créer des réseaux locaux. Souscrivez depuis votre tableau de bord.',
    }
  }

  // 2. Compte les locaux existants rattachés à ce national
  const { totalDocs: nbLocaux } = await payload.count({
    collection: 'reseaux',
    where: {
      and: [
        { parent: { equals: national.id } },
        { niveau: { equals: 'local' } },
      ],
    },
    overrideAccess: true,
  })

  const palier = (national.palier as string | null | undefined)
  const max = maxLocaux(palier)
  if (nbLocaux >= max) {
    return {
      autorise: false,
      raison: `Votre palier "${palier ?? PALIER_DEFAUT}" autorise au maximum ${max} réseau(x) local/locaux. ` +
              `Vous en avez déjà ${nbLocaux}. Contactez-nous pour monter de palier.`,
    }
  }

  return { autorise: true }
}
