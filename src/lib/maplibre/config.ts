/**
 * Configuration MapLibre GL JS (ADR-0006).
 * Remplace la configuration Mapbox (src/lib/mapbox/config.ts).
 * Utilise OpenFreeMap — tuiles OSM libres, sans clé d'API.
 * Voir https://openfreemap.org
 */

export const MAP_DEFAULTS = {
  /** Centre de la France métropolitaine */
  center: [1.888334, 46.603354] as [number, number],
  /** Zoom pour voir toute la France */
  zoom: 5.5,
} as const

/**
 * Style OpenFreeMap "liberty" — basé sur OSM, claire, lisible, sans API key.
 * Alternative production avec SLA : MapTiler (nécessite NEXT_PUBLIC_MAPTILER_KEY).
 */
export const OSM_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

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
  /** Navy : marqueur événement standard */
  evenement: '#16284f',
  /** Violet secondaire : marqueur réseau local (chapitre/section — ADR-0012) */
  reseau: '#a855f7',
  /** Gris neutre : états vides, marqueurs sans catégorie */
  neutral: '#9ca3af',
  /** Blanc : bordure des marqueurs */
  white: '#ffffff',
} as const
