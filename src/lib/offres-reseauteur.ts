/**
 * lib/offres-reseauteur.ts — Avantages des deux niveaux du compte réseauteur.
 *
 * Source unique de la copie commerciale : page d'accueil (« Comment ça fonctionne »)
 * et tunnel d'inscription (écran « Choisissez votre formule ») lisent ces listes.
 * Elles étaient dupliquées dans `/inscription` ; toute divergence est une promesse
 * commerciale contradictoire selon la page d'entrée.
 *
 * ⚠️ Copie d'AFFICHAGE. Les gates réels (création d'événements, quota de réseaux
 * locaux) sont posés côté serveur — cf. `lib/reseau-hierarchie.ts` et les actions
 * du dashboard. Le prix affiché vient de `lib/tarifs.ts` (PRIX_PLUS_HT), lui-même
 * à maintenir égal au Price Stripe.
 *
 * Module sans dépendance → importable côté client comme serveur.
 */
import { MAX_LOCAUX_PLUS } from './reseau-hierarchie'

/** Compte réseauteur gratuit — ce qui est inclus sans payer. */
export const AVANTAGES_GRATUIT: string[] = [
  "Création d'une fiche professionnelle",
  'Être visible sur la carte des Réseauteurs',
  'Être contacté par les autres membres',
  'Rechercher et contacter les Réseauteurs',
  'Consulter tous les événements',
  "S'inscrire aux événements",
  'Découvrir les réseaux partenaires',
  'Accéder aux offres réservées aux réseauteurs',
]

/**
 * Réseaux locaux ouverts par le Plus (ADR-0014). Constante à part : la page
 * d'inscription la cite seule, au milieu d'un récit centré sur les événements.
 */
export const AVANTAGE_PLUS_RESEAUX_LOCAUX = `Créer jusqu'à ${MAX_LOCAUX_PLUS} fiches de réseaux locaux — affiliées à un réseau national ou indépendantes`

/** Réseauteur Plus — ce que l'abonnement ajoute au gratuit (ADR-0014/0015). */
export const AVANTAGES_PLUS: string[] = [
  'Créer vos propres événements, en illimité',
  'Gérer la liste des inscrits à vos événements',
  'Modifier ou annuler vos événements à tout moment',
  AVANTAGE_PLUS_RESEAUX_LOCAUX,
  'Publier les événements de vos réseaux locaux',
]

/** Types de rencontres qu'un réseauteur Plus peut organiser (illustration). */
export const EXEMPLES_EVENEMENTS: string[] = [
  'Petit-déjeuner networking',
  'Déjeuner entre entrepreneurs',
  'Afterwork',
  'Visite de votre entreprise',
  'Rencontre informelle',
  'Atelier ou conférence',
]

/** Champs que l'organisateur renseigne à la création d'un événement. */
export const CHAMPS_EVENEMENT: string[] = [
  'le titre',
  'la description',
  'la date',
  'les horaires',
  'le lieu',
  'le nombre de places',
  "les modalités d'inscription",
  'les éventuelles conditions de participation',
]
