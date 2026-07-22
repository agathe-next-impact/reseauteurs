/** Couleurs speciales (non liees a une categorie dynamique) */
export const SPECIAL_COLORS = {
  'gratuit': '#999A9D',
  'evenement-national': '#8A6D0B',
} as const

/**
 * @deprecated Utiliser les couleurs dynamiques depuis les collections categories-activite / types-evenement.
 * Conserve pour retrocompatibilite des expressions Mapbox qui lisent la propriete `activiteCouleur` du GeoJSON.
 */
export const MARKER_COLORS = {
  ...SPECIAL_COLORS,
} as const

/** Styles Mapbox Studio custom */
export const MAP_STYLES = {
  light: 'mapbox://styles/agat3264/cmncx7u0f000701picq1n0iwj',
  dark: 'mapbox://styles/agat3264/cmncxhpp8007d01sb84o83c0r',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
} as const

/** Traduction francaise des classes POI Mapbox (layer poi-label, streets-v12) */
export const POI_CLASS_LABELS: Record<string, string> = {
  food_and_drink: 'Restaurant & bar',
  shop: 'Commerce',
  lodging: 'Hebergement',
  park_like: 'Parc & loisirs',
  education: 'Education',
  medical: 'Sante',
  place_of_worship: 'Lieu de culte',
  sport_and_leisure: 'Sport & loisirs',
  historic: 'Lieu historique',
  arts_and_entertainment: 'Culture & divertissement',
  commercial_services: 'Services',
  motorist: 'Station-service',
  public_facilities: 'Services publics',
}
