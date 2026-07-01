'use client'

import { useMemo } from 'react'
import { Source, Layer } from 'react-map-gl/mapbox'
import type { DirectionsRoute, CongestionLevel } from '@/types/map'

const CONGESTION_COLORS: Record<CongestionLevel, string> = {
  unknown: '#3b82f6',
  low: '#3b82f6',
  moderate: '#f59e0b',
  heavy: '#ef4444',
  severe: '#991b1b',
}

/** Split a route geometry into per-segment LineStrings with congestion property */
function buildCongestionFeatures(route: DirectionsRoute): GeoJSON.FeatureCollection {
  const coords = route.geometry.coordinates
  const congestion = route.legs?.[0]?.annotation?.congestion

  // No congestion data → single feature with default color
  if (!congestion || congestion.length === 0) {
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: route.geometry,
          properties: { congestion: 'low' },
        },
      ],
    }
  }

  // Group consecutive segments with the same congestion level
  const features: GeoJSON.Feature[] = []
  let currentLevel = congestion[0]
  let currentCoords: [number, number][] = [coords[0] as [number, number]]

  for (let i = 0; i < congestion.length; i++) {
    const level = congestion[i]
    const nextCoord = coords[i + 1] as [number, number]
    if (!nextCoord) break

    if (level !== currentLevel) {
      // Flush current group
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: currentCoords },
        properties: { congestion: currentLevel },
      })
      currentLevel = level
      currentCoords = [coords[i] as [number, number]]
    }
    currentCoords.push(nextCoord)
  }

  // Flush last group
  if (currentCoords.length >= 2) {
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: currentCoords },
      properties: { congestion: currentLevel },
    })
  }

  return { type: 'FeatureCollection', features }
}

interface RouteLayerProps {
  route: DirectionsRoute | null
  alternatives?: DirectionsRoute[]
}

export default function RouteLayer({ route, alternatives = [] }: RouteLayerProps) {
  const routeGeoJSON = useMemo(() => {
    if (!route) return null
    return buildCongestionFeatures(route)
  }, [route])

  const altGeoJSONs = useMemo(
    () =>
      alternatives.map((alt) => ({
        type: 'Feature' as const,
        geometry: alt.geometry,
        properties: {},
      })),
    [alternatives],
  )

  if (!routeGeoJSON) return null

  return (
    <>
      {/* Alternative routes (rendered below main) */}
      {altGeoJSONs.map((alt, i) => (
        <Source key={`route-alt-${i}`} id={`route-alt-${i}`} type="geojson" data={alt}>
          <Layer
            id={`route-alt-line-${i}`}
            type="line"
            paint={{
              'line-color': '#94a3b8',
              'line-width': 4,
              'line-opacity': 0.4,
            }}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          />
        </Source>
      ))}

      {/* Main route — colored by congestion */}
      <Source id="route" type="geojson" data={routeGeoJSON}>
        {/* Outline */}
        <Layer
          id="route-outline"
          type="line"
          paint={{
            'line-color': '#1e293b',
            'line-width': 7,
            'line-opacity': 0.3,
          }}
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        />
        {/* Congestion-colored line */}
        <Layer
          id="route-line"
          type="line"
          paint={{
            'line-color': [
              'match',
              ['get', 'congestion'],
              'severe', CONGESTION_COLORS.severe,
              'heavy', CONGESTION_COLORS.heavy,
              'moderate', CONGESTION_COLORS.moderate,
              CONGESTION_COLORS.low,
            ],
            'line-width': 5,
            'line-opacity': 0.85,
          }}
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        />
      </Source>
    </>
  )
}
