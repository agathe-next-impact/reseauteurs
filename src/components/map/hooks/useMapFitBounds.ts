'use client'

import { useCallback } from 'react'
import type { MapRef } from 'react-map-gl/mapbox'
import mapboxgl from 'mapbox-gl'
import type { DirectionsRoute } from '@/types/map'

export function useMapFitBounds(mapRef: React.RefObject<MapRef | null>) {
  const fitToRoute = useCallback(
    (route: DirectionsRoute) => {
      const map = mapRef.current?.getMap()
      if (!map) return
      const coords = route.geometry.coordinates as [number, number][]
      if (coords.length === 0) return

      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new mapboxgl.LngLatBounds(coords[0], coords[0]),
      )
      map.fitBounds(bounds, { padding: 60, duration: 500 })
    },
    [mapRef],
  )

  const fitToPoint = useCallback(
    (lng: number, lat: number, zoom = 14) => {
      mapRef.current?.getMap()?.flyTo({ center: [lng, lat], zoom, duration: 800 })
    },
    [mapRef],
  )

  return { fitToRoute, fitToPoint }
}
