'use client'

import { useState, useCallback } from 'react'
import type { MapRef } from 'react-map-gl/mapbox'
import type { POIInfo } from '@/types/map'
import { POI_CLASS_LABELS } from '@/lib/mapbox/styles'
import type { GeoJSONFeature } from 'mapbox-gl'

export function usePOIInteraction(_mapRef: React.RefObject<MapRef | null>) {
  const [poiPopup, setPoiPopup] = useState<POIInfo | null>(null)

  const handlePOIClick = useCallback(
    (feature: GeoJSONFeature, lngLat: { lng: number; lat: number }) => {
      const name = (feature.properties?.name as string) ?? 'Lieu'
      const cls = (feature.properties?.class as string) ?? ''
      const label = POI_CLASS_LABELS[cls] ?? cls
      setPoiPopup({ longitude: lngLat.lng, latitude: lngLat.lat, name, category: label })
    },
    [],
  )

  const closePoiPopup = useCallback(() => setPoiPopup(null), [])

  return {
    poiPopup,
    closePoiPopup,
    handlePOIClick,
  }
}
