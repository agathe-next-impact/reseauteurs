/**
 * lib/badge.ts — Dérivation du badge réseauteur (ADR-0011 §5).
 *
 * Le badge est DÉCLARATIF en V1 : dérivé de la réponse de l'utilisateur à
 * « Combien d'événements de networking fréquentez-vous chaque mois ? »
 *
 * Règle de calcul :
 *   0–1  → Bronze
 *   2–5  → Argent
 *   6–10 → Gold
 *   > 10 → Platinum
 *
 * Le référentiel `badges` (collection Payload) stocke libellés / visuels
 * gérables par l'admin, sans créer de FK sur les reseauteurs (la valeur
 * stockée est l'enum string, pas un ID).
 *
 * Évolution future (§12) : badge vérifié — sans remettre en cause ce schéma.
 */

export type BadgeNiveau = 'bronze' | 'argent' | 'gold' | 'platinum'

/**
 * Dérive le niveau de badge depuis le nombre d'événements/mois déclaré.
 * Retourne `null` si la valeur est absente ou invalide (pas encore renseignée).
 */
export function deriverBadge(evenementsParMois: number | null | undefined): BadgeNiveau | null {
  if (evenementsParMois == null || evenementsParMois < 0) return null
  if (evenementsParMois <= 1) return 'bronze'
  if (evenementsParMois <= 5) return 'argent'
  if (evenementsParMois <= 10) return 'gold'
  return 'platinum'
}

/**
 * Libellé français du badge (pour l'affichage UI).
 */
export const BADGE_LABELS: Record<BadgeNiveau, string> = {
  bronze: 'Bronze',
  argent: 'Argent',
  gold: 'Gold',
  platinum: 'Platinum',
}

/**
 * Seuils de définition des badges (utile pour les composants UI / légende carte).
 */
export const BADGE_SEUILS: Array<{ niveau: BadgeNiveau; min: number; max: number | null; label: string }> = [
  { niveau: 'bronze',   min: 0,  max: 1,    label: '0 à 1 événement/mois' },
  { niveau: 'argent',   min: 2,  max: 5,    label: '2 à 5 événements/mois' },
  { niveau: 'gold',     min: 6,  max: 10,   label: '6 à 10 événements/mois' },
  { niveau: 'platinum', min: 11, max: null,  label: 'Plus de 10 événements/mois' },
]
