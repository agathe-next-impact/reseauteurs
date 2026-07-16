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
  { value: 'bronze', label: 'Bronze', color: '#b45309' },
  { value: 'argent', label: 'Argent', color: '#64748b' },
  { value: 'gold', label: 'Gold', color: '#f5851f' },
  { value: 'platinum', label: 'Platinum', color: '#2563EB' },
] as const

/** Couleur de repli d'un marqueur réseauteur sans badge renseigné. */
export const BADGE_MARKER_FALLBACK = '#9ca3af'

/** Couleurs utilisées pour les marqueurs et clusters — tokens RÉSEAUTEURS (DESIGN.md §2) */
export const MAP_COLORS = {
  /** Bleu primaire : marqueur réseauteur standard, cluster */
  primary: '#2563EB',
  /**
   * Orange accent : CTA, conversion.
   * Conservé pour les fiches événements (MiniMap) et d'autres usages futurs.
   * N'est plus utilisé comme couleur de marqueur « Premium » sur la carte des
   * événements (ADR-0012 : événement Premium supprimé).
   */
  premium: '#f5851f',
  /** Navy : marqueur événement organisé par un réseau */
  evenement: '#16284f',
  /** Orange accent : marqueur événement organisé par un réseauteur Plus (ADR-0013) */
  evenementReseauteur: '#f5851f',
  /** Violet secondaire : marqueur réseau local (groupe/section — ADR-0012) */
  reseau: '#a855f7',
  /** Gris neutre : états vides, marqueurs sans catégorie */
  neutral: '#9ca3af',
  /** Blanc : bordure des marqueurs */
  white: '#ffffff',
} as const
