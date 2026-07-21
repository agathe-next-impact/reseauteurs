/**
 * lib/tarifs.ts — Tarifs AFFICHÉS dans le dashboard (HT, annuels).
 *
 * ⚠️ Valeurs d'AFFICHAGE uniquement. Le montant réellement facturé provient du Price
 * Stripe (STRIPE_PLUS_PRICE_ID / STRIPE_PRICE_NATIONAL_* / STRIPE_PARTENAIRE_ANNONCEUR_PRICE_ID).
 * Ces constantes DOIVENT être maintenues égales aux montants des Price Stripe correspondants.
 *
 * Module sans dépendance (pas de SDK Stripe) → importable côté client comme serveur.
 */

/** Réseauteur Plus (abonnement individuel). */
export const PRIX_PLUS_HT = 39

/** Partenaire annonceur (abonnement de visibilité). */
export const PRIX_ANNONCEUR_HT = 189

/** Paliers d'abonnement du réseau national partenaire (clé = palier). */
export const PALIER_PRIX_HT: Record<string, number> = {
  fiche: 89,
  starter: 139,
  growth: 199,
  enterprise: 289,
}

/** Formate un montant HT annuel : `89 € HT / an`. */
export function formatEuroHTAn(euros: number | null | undefined): string | null {
  if (euros == null) return null
  return `${euros} € HT / an`
}
