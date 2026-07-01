/**
 * lib/stripe.ts — Plomberie Stripe recalibrée sur les 2 produits B2B (ADR-0012 §3).
 *
 * DEUX produits B2B — pas de palier freemium réseauteur, pas d'événement Premium :
 *   1. Réseau national partenaire : Subscription annuelle par paliers
 *      → national.partenaire = true + national.palier = 'starter'|'growth'|'enterprise'
 *   2. Partenaire annonceur      : Subscription → partenaire.statut = 'actif'
 *
 * L'événement Premium ponctuel (ADR-0011 §3) est SUPPRIMÉ (ADR-0012 §3).
 *
 * Variables d'environnement requises :
 *   STRIPE_SECRET_KEY
 *   STRIPE_PRICE_NATIONAL_STARTER    — TODO : IDs réels à fournir par le product owner
 *   STRIPE_PRICE_NATIONAL_GROWTH     — TODO : IDs réels à fournir par le product owner
 *   STRIPE_PRICE_NATIONAL_ENTERPRISE — TODO : IDs réels à fournir par le product owner
 *   STRIPE_PARTENAIRE_ANNONCEUR_PRICE_ID
 *   STRIPE_WEBHOOK_SECRET
 *
 * Anciens : STRIPE_RESEAU_PARTENAIRE_PRICE_ID, STRIPE_EVENEMENT_PREMIUM_PRICE_ID retirés.
 */
import Stripe from 'stripe'

// Initialisation lazy : on ne throw PAS au chargement du module pour permettre
// à `payload generate:types` de fonctionner sans .env local (mode code-prep).
// La vérification se produit à la première utilisation effective de `stripe`.
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error(
        'STRIPE_SECRET_KEY is not set. Configurez-la dans .env.local ou les variables Vercel.',
      )
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      // Version pinnée — garantit que les endpoints (ex. billing portal) existent
      // quelle que soit la version configurée sur le dashboard Stripe.
      apiVersion: '2026-02-25.clover',
    })
  }
  return _stripe
}

// Export de convenance (rétrocompat interne des routes qui font `import { stripe }`)
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

// ─────────────────────────────────────────────────────────────────
// PALIERS D'ABONNEMENT NATIONAL (ADR-0012 §3 — Q5)
// ─────────────────────────────────────────────────────────────────

/**
 * Paliers d'abonnement du réseau national.
 * Les priceId Stripe sont lus depuis l'env — JAMAIS en dur dans le code.
 *
 * TODO : remplacer les variables d'env par les IDs de produits réels
 * fournis par le product owner (Dashboard Stripe > Produits > Copier l'ID de prix).
 * - STRIPE_PRICE_NATIONAL_STARTER    : abonnement Starter (jusqu'à 5 locaux)
 * - STRIPE_PRICE_NATIONAL_GROWTH     : abonnement Growth (jusqu'à 25 locaux)
 * - STRIPE_PRICE_NATIONAL_ENTERPRISE : abonnement Enterprise (locaux illimités)
 */
export const PALIERS_NATIONAL: Record<
  string,
  { label: string; get priceId(): string | undefined }
> = {
  starter: {
    label: 'Starter',
    get priceId() {
      return process.env.STRIPE_PRICE_NATIONAL_STARTER
    },
  },
  growth: {
    label: 'Growth',
    get priceId() {
      return process.env.STRIPE_PRICE_NATIONAL_GROWTH
    },
  },
  enterprise: {
    label: 'Enterprise',
    get priceId() {
      return process.env.STRIPE_PRICE_NATIONAL_ENTERPRISE
    },
  },
}

/**
 * Retourne le nom du palier à partir d'un priceId Stripe.
 * Utilisé par les webhooks pour réconcilier le palier sans faire confiance au client.
 * Retourne null si le priceId ne correspond à aucun palier configuré.
 */
export function getPalierFromPriceId(priceId: string): string | null {
  for (const [palier, cfg] of Object.entries(PALIERS_NATIONAL)) {
    if (cfg.priceId && cfg.priceId === priceId) return palier
  }
  return null
}

// ─────────────────────────────────────────────────────────────────
// PRODUITS B2B (ADR-0012 §3)
// ─────────────────────────────────────────────────────────────────

/**
 * Descripteurs des 2 produits B2B.
 * L'événement Premium (ADR-0011) est SUPPRIMÉ (ADR-0012).
 */
export const PRODUITS = {
  reseauPartenaire: {
    label: 'Réseau national partenaire',
    mode: 'subscription' as const,
    /**
     * Retourne le priceId pour un palier donné.
     * @param palier 'starter' | 'growth' | 'enterprise' (défaut : 'starter')
     */
    priceIdForPalier(palier: string = 'starter'): string | undefined {
      return PALIERS_NATIONAL[palier]?.priceId
    },
  },
  partenaireAnnonceur: {
    label: 'Partenaire annonceur',
    get priceId() {
      return process.env.STRIPE_PARTENAIRE_ANNONCEUR_PRICE_ID
    },
    mode: 'subscription' as const,
  },
} as const

export type ProduitB2B = keyof typeof PRODUITS

// ─────────────────────────────────────────────────────────────────
// HELPERS DE RECONCILIATION STRIPE
// ─────────────────────────────────────────────────────────────────

/**
 * Lit current_period_end en gérant les DEUX formats Stripe :
 *   - API >= 2025-03-31.basil : le champ est sur l'item de subscription
 *     (`subscription.items.data[0].current_period_end`).
 *   - API < 2025-03-31.basil : le champ est sur la subscription
 *     (`subscription.current_period_end`).
 *
 * Appelée partout où on dérive partenaireExpireAt / abonnementExpireAt
 * depuis une subscription Stripe.
 * Renvoie un timestamp epoch (secondes) ou null si introuvable.
 */
export function getSubscriptionPeriodEnd(
  subscription: Stripe.Subscription,
): number | null {
  const item = subscription.items?.data?.[0] as
    | (Stripe.SubscriptionItem & { current_period_end?: number })
    | undefined
  if (item && typeof item.current_period_end === 'number') {
    return item.current_period_end
  }
  const legacy = (subscription as unknown as { current_period_end?: number }).current_period_end
  return typeof legacy === 'number' ? legacy : null
}

/**
 * Résout le type de produit B2B depuis les metadata de la session ou subscription Stripe.
 * Retourne null si le type n'est pas reconnu (event inconnu ou test).
 *
 * Note : 'evenement_premium' retiré (ADR-0012 §3 — Premium supprimé).
 */
export function resolveProduitFromMetadata(
  metadata: Record<string, string | null | undefined> | null | undefined,
): ProduitB2B | null {
  const t = metadata?.type
  if (t === 'reseau_partenaire') return 'reseauPartenaire'
  if (t === 'partenaire_annonceur') return 'partenaireAnnonceur'
  return null
}
