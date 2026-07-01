'use client'

import { Map, NavigationControl, GeolocateControl } from 'react-map-gl/mapbox'
import type { MapRef, MapMouseEvent, MapEvent } from 'react-map-gl/mapbox'
import { MAPBOX_TOKEN, MAP_DEFAULTS } from '@/lib/mapbox/config'

interface MapContainerProps {
  mapRef: React.RefObject<MapRef | null>
  mapStyle: string
  interactiveLayerIds: string[]
  onClick?: (e: MapMouseEvent) => void
  onMouseEnter?: (e: MapMouseEvent) => void
  onMouseLeave?: () => void
  onLoad?: (e: MapEvent) => void
  cursor?: string
  children?: React.ReactNode
}

export default function MapContainer({
  mapRef,
  mapStyle,
  interactiveLayerIds,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onLoad,
  cursor = 'auto',
  children,
}: MapContainerProps) {
  const initialViewState = {
    longitude: MAP_DEFAULTS.center[0],
    latitude: MAP_DEFAULTS.center[1],
    zoom: MAP_DEFAULTS.zoom,
  }

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={MAPBOX_TOKEN}
      mapStyle={mapStyle}
      initialViewState={initialViewState}
      fadeDuration={0}
      interactiveLayerIds={interactiveLayerIds}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onLoad={onLoad}
      cursor={cursor}
      style={{ width: '100%', height: '100%' }}
      aria-label="Carte interactive"
    >
      <NavigationControl position="top-left" />
      <GeolocateControl position="top-left" trackUserLocation />
      {children}
    </Map>
  )
}
