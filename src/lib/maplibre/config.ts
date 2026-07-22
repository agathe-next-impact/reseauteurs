/**
 * Configuration MapLibre GL JS (ADR-0006).
 * Remplace la configuration Mapbox (src/lib/mapbox/config.ts).
 * Utilise OpenFreeMap — tuiles OSM libres, sans clé d'API.
 * Voir https://openfreemap.org
 */

export const MAP_DEFAULTS = {
  /** Centre de la France métropolitaine */
  center: [1.888334, 46.603354] as [number, number],
  /** Zoom de repli (préférer FRANCE_BOUNDS : un zoom fixe coupe la France selon le viewport) */
  zoom: 5.5,
} as const

/**
 * Emprise de la France métropolitaine, Corse incluse — [[ouest, sud], [est, nord]].
 * Cadrage initial des cartes via fitBounds : le zoom s'adapte au viewport,
 * garantissant que TOUTE la France est visible au chargement (mobile compris).
 */
export const FRANCE_BOUNDS: [[number, number], [number, number]] = [
  [-5.4, 41.2],
  [9.8, 51.3],
]

/** Marge (px) autour de l'emprise France lors du fitBounds. */
export const FRANCE_FIT_PADDING = 24

/**
 * Style OpenFreeMap "liberty" — basé sur OSM, claire, lisible, sans API key.
 * Alternative production avec SLA : MapTiler (nécessite NEXT_PUBLIC_MAPTILER_KEY).
 */
export const OSM_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

/** Style clair (défaut) — alias de OSM_STYLE_URL. */
export const MAP_STYLE_LIGHT = OSM_STYLE_URL

/**
 * Style sombre — CARTO "dark-matter" (GL, OSM, sans clé, attribution CARTO/OSM).
 * Utilisé quand le thème sombre `.ir-plasma` est actif (cohérence avec le reste du site).
 */
export const MAP_STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

/**
 * Couleurs de marqueur par badge réseauteur (DESIGN.md §5/§6, CLAUDE.md §5).
 * Sert à la fois à l'expression MapLibre `match` (paint) et à la légende.
 * Ordre = progression Bronze → Argent → Gold → Platinum.
 */
export const BADGE_MARKER_COLORS = [
  { value: 'bronze', label: 'Bronze', color: '#8A6D0B' },
  { value: 'argent', label: 'Argent', color: '#6E7175' },
  { value: 'gold', label: 'Gold', color: '#F5E050' },
  { value: 'platinum', label: 'Platinum', color: '#035AA6' },
] as const

/** Couleur de repli d'un marqueur réseauteur sans badge renseigné. */
export const BADGE_MARKER_FALLBACK = '#CFD0D2'

/** Couleurs utilisées pour les marqueurs et clusters — tokens RÉSEAUTEURS (DESIGN.md §2) */
export const MAP_COLORS = {
  /** Bleu primaire : marqueur réseauteur standard, cluster */
  primary: '#035AA6',
  /**
   * Jaune accent : CTA, conversion.
   * Conservé pour les fiches événements (MiniMap) et d'autres usages futurs.
   * N'est plus utilisé comme couleur de marqueur « Premium » sur la carte des
   * événements (ADR-0012 : événement Premium supprimé).
   */
  premium: '#F5E050',
  /** Navy : marqueur événement organisé par un réseau */
  evenement: '#012A4A',
  /** Jaune accent : marqueur événement organisé par un réseauteur Plus (ADR-0013) */
  evenementReseauteur: '#F5E050',
  /** Bleu médian : marqueur réseau local (groupe/section — ADR-0012) */
  reseau: '#3E7CA6',
  /** Gris neutre : états vides, marqueurs sans catégorie */
  neutral: '#999A9D',
  /** Blanc : bordure des marqueurs */
  white: '#ffffff',
} as const
