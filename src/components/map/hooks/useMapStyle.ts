'use client'

import { MAP_STYLES } from '@/lib/mapbox/config'

// Switcher light/dark/auto/satellite désactivé — mode clair uniquement.
export function useMapStyle() {
  return { mapStyle: MAP_STYLES.light }
}
