export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

export const MAP_DEFAULTS = {
  center: [1.888334, 46.603354] as [number, number],
  zoom: 4.8,
  language: 'fr',
} as const

export const MAP_STYLES = {
  light: 'mapbox://styles/agat3264/cmncx7u0f000701picq1n0iwj',
  dark: 'mapbox://styles/agat3264/cmncxhpp8007d01sb84o83c0r',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
} as const
