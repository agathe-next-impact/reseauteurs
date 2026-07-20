/**
 * lib/abonnement.ts — Résolveur commun d'abonnement (hub /dashboard/abonnement).
 *
 * Objectif : donner à CHAQUE type de souscripteur (réseauteur Plus, organisateur de
 * réseau national, partenaire annonceur) une gestion complète et cohérente de son
 * abonnement, à partir d'un descripteur unique `AbonnementContext`.
 *
 * Trois porteurs de données Stripe distincts, unifiés ici :
 *   - Réseauteur Plus     → `users`       (plusActif / plusExpireAt / plusSource /
 *                                          stripeSubscriptionId / stripeCustomerId)
 *   - Organisateur        → réseau NATIONAL `reseaux` (partenaire / palier /
 *                                          partenaireExpireAt / stripeSubscriptionId) +
 *                                          `users.stripeCustomerId`
 *   - Partenaire annonceur→ `partenaires`  (statut / abonnementExpireAt /
 *                                          stripeSubscriptionId / stripeCustomerId)
 *
 * INVARIANT (§11) : `statutGate` (l'accès) provient TOUJOURS de la DB, posée par les
 * webhooks Stripe. Le détail « annulation programmée / renouvellement » est lu EN DIRECT
 * chez Stripe (`fetchLiveStripeState`) — pas de champ DB, pas de migration ; ces pages
 * dashboard sont à faible trafic et la lecture live est toujours exacte.
 *
 * `resolveAbonnement` ne résout QUE le porteur du caller → l'ownership est garanti par
 * construction : les routes cancel/reactivate/change-palier n'agissent jamais sur
 * l'abonnement d'un autre utilisateur.
 */
import type { Payload } from 'payload'
import type Stripe from 'stripe'
import { stripe, getSubscriptionPeriodEnd, getPalierFromPriceId } from '@/lib/stripe'

export type AbonnementProduit = 'reseauteur_plus' | 'reseau_partenaire' | 'partenaire_annonceur'

/** Descripteur unifié d'un abonnement, indépendant du porteur (DB = source de l'accès). */
export interface AbonnementContext {
  produit: AbonnementProduit
  /** Libellé humain — ex. « Réseauteur Plus », « Réseau national partenaire — BNI ». */
  label: string
  porteur: { collection: 'users' | 'reseaux' | 'partenaires'; id: string | number } | null
  customerId: string | null
  subscriptionId: string | null
  /** Accès effectif, lu en DB (posé par webhook). Jamais dérivé du client. */
  statutGate: 'actif' | 'inactif'
  /** Fin de période / expiration connue en DB (ISO). */
  expireAt: string | null
  /** Palier courant — organisateur uniquement. */
  palier: string | null
  /** Vrai pour le seul produit multi-paliers (réseau national). */
  supportsPalier: boolean
  /** Id du réseau national — nécessaire à /api/stripe/change-palier. */
  reseauId?: string | number
  /** Origine du Plus : 'abonnement' (gérable) ou 'licence' (legacy, lecture seule). */
  source?: 'abonnement' | 'licence' | null
  /**
   * Raison d'absence de porteur gérable (pour l'UI du hub) :
   *   - 'gratuit'      : réseauteur sans abonnement → upsell
   *   - 'sans_reseau'  : organisateur sans fiche nationale → créer la fiche
   *   - 'sans_fiche'   : partenaire sans fiche → créer la fiche
   */
  motifIndisponible?: 'gratuit' | 'sans_reseau' | 'sans_fiche' | null
}

/** État live d'une subscription Stripe (annulation programmée, renouvellement, palier). */
export interface LiveStripeState {
  status: Stripe.Subscription.Status
  /** Fin de période courante (ISO) — date de renouvellement OU de fin si annulation programmée. */
  currentPeriodEnd: string | null
  /** Vrai si l'abonnement est programmé pour s'arrêter à la fin de la période. */
  cancelAtPeriodEnd: boolean
  /** Palier dérivé du priceId courant (réseau national). */
  palier: string | null
}

interface FreshUserLike {
  id: string | number
  role?: string | null
  email?: string
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  plusActif?: boolean | null
  plusExpireAt?: string | null
  plusSource?: string | null
}

/**
 * Résout l'abonnement du user courant selon son rôle. Toujours non-null pour un rôle
 * souscripteur (réseauteur / organisateur / partenaire) — renvoie un contexte « inactif »
 * avec `motifIndisponible` quand il n'y a pas encore d'abonnement. `null` pour admin/autre.
 *
 * ⚠️ Appeler avec un user FRAIS (findByID) — jamais le JWT.
 */
export async function resolveAbonnement(
  freshUser: FreshUserLike,
  payload: Payload,
): Promise<AbonnementContext | null> {
  const role = freshUser.role

  // ── Réseauteur Plus ────────────────────────────────────────────────
  if (role === 'reseauteur') {
    const plusActif = freshUser.plusActif === true
    const expireAt = freshUser.plusExpireAt ?? null
    const source = (freshUser.plusSource as 'abonnement' | 'licence' | null | undefined) ?? null
    const actif = plusActif && (!expireAt || new Date(expireAt).getTime() > Date.now())
    return {
      produit: 'reseauteur_plus',
      label: 'Réseauteur Plus',
      porteur: { collection: 'users', id: freshUser.id },
      customerId: freshUser.stripeCustomerId ?? null,
      subscriptionId: freshUser.stripeSubscriptionId ?? null,
      statutGate: actif ? 'actif' : 'inactif',
      expireAt,
      palier: null,
      supportsPalier: false,
      source,
      motifIndisponible: actif ? null : 'gratuit',
    }
  }

  // ── Organisateur → réseau national ─────────────────────────────────
  if (role === 'organisateur') {
    const { docs } = await payload.find({
      collection: 'reseaux',
      where: { and: [{ user: { equals: freshUser.id } }, { niveau: { not_equals: 'local' } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const reseau = docs[0] as unknown as Record<string, unknown> | undefined
    if (!reseau) {
      return {
        produit: 'reseau_partenaire',
        label: 'Réseau national partenaire',
        porteur: null,
        customerId: freshUser.stripeCustomerId ?? null,
        subscriptionId: null,
        statutGate: 'inactif',
        expireAt: null,
        palier: null,
        supportsPalier: true,
        motifIndisponible: 'sans_reseau',
      }
    }
    const actif = reseau.partenaire === true
    return {
      produit: 'reseau_partenaire',
      label: `Réseau national partenaire — ${(reseau.nom as string) ?? 'votre réseau'}`,
      porteur: { collection: 'reseaux', id: reseau.id as string | number },
      customerId: freshUser.stripeCustomerId ?? null,
      subscriptionId: (reseau.stripeSubscriptionId as string | null) ?? null,
      statutGate: actif ? 'actif' : 'inactif',
      expireAt: (reseau.partenaireExpireAt as string | null) ?? null,
      palier: (reseau.palier as string | null) ?? null,
      supportsPalier: true,
      reseauId: reseau.id as string | number,
      motifIndisponible: actif ? null : null,
    }
  }

  // ── Partenaire annonceur ───────────────────────────────────────────
  if (role === 'partenaire') {
    const { docs } = await payload.find({
      collection: 'partenaires',
      where: { user: { equals: freshUser.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const partenaire = docs[0] as unknown as Record<string, unknown> | undefined
    if (!partenaire) {
      return {
        produit: 'partenaire_annonceur',
        label: 'Partenaire annonceur',
        porteur: null,
        customerId: freshUser.stripeCustomerId ?? null,
        subscriptionId: null,
        statutGate: 'inactif',
        expireAt: null,
        palier: null,
        supportsPalier: false,
        motifIndisponible: 'sans_fiche',
      }
    }
    const actif = partenaire.statut === 'actif'
    return {
      produit: 'partenaire_annonceur',
      label: `Partenaire annonceur — ${(partenaire.nom as string) ?? 'votre entreprise'}`,
      porteur: { collection: 'partenaires', id: partenaire.id as string | number },
      customerId:
        (partenaire.stripeCustomerId as string | null) ?? freshUser.stripeCustomerId ?? null,
      subscriptionId: (partenaire.stripeSubscriptionId as string | null) ?? null,
      statutGate: actif ? 'actif' : 'inactif',
      expireAt: (partenaire.abonnementExpireAt as string | null) ?? null,
      palier: null,
      supportsPalier: false,
      motifIndisponible: null,
    }
  }

  // admin / autre : pas de hub abonnement (gestion back-office)
  return null
}

/**
 * Lit l'état LIVE d'une subscription Stripe. Tolérant aux erreurs (retourne null) :
 * une panne Stripe ne doit jamais casser la page — l'UI retombe sur les valeurs DB.
 */
export async function fetchLiveStripeState(
  subscriptionId: string | null | undefined,
): Promise<LiveStripeState | null> {
  if (!subscriptionId) return null
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId)
    const periodEnd = getSubscriptionPeriodEnd(sub)
    const priceId = sub.items?.data?.[0]?.price?.id
    return {
      status: sub.status,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end === true,
      palier: priceId ? getPalierFromPriceId(priceId) : null,
    }
  } catch (err) {
    console.error('[lib/abonnement] fetchLiveStripeState failed:', err)
    return null
  }
}

/** Mappe un `AbonnementProduit` vers le `type` attendu par /api/stripe/checkout. */
export function checkoutTypeForProduit(produit: AbonnementProduit): string {
  return produit // les valeurs coïncident avec la discriminated union du checkout
}
