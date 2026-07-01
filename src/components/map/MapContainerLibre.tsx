// @ts-nocheck — types en attente de generate:types + versions MapLibre (map-engineer)
'use client'
/**
 * MapContainerLibre — Conteneur de carte MapLibre GL JS (ADR-0006).
 * Remplace MapContainer.tsx (Mapbox) pour les nouvelles cartes RÉSEAUTEURS.
 * Pas de token requis : utilise des tuiles OSM via OpenFreeMap.
 */

import { Map, NavigationControl, GeolocateControl } from 'react-map-gl/maplibre'
import type { MapRef, MapMouseEvent, MapEvent } from 'react-map-gl/maplibre'
import { MAP_DEFAULTS, OSM_STYLE_URL } from '@/lib/maplibre/config'
import 'maplibre-gl/dist/maplibre-gl.css'

export interface MapContainerLibreProps {
  mapRef: React.RefObject<MapRef | null>
  interactiveLayerIds: string[]
  onClick?: (e: MapMouseEvent) => void
  onMouseEnter?: (e: MapMouseEvent) => void
  onMouseLeave?: () => void
  onLoad?: (e: MapEvent) => void
  onMoveEnd?: () => void
  cursor?: string
  children?: React.ReactNode
}

export default function MapContainerLibre({
  mapRef,
  interactiveLayerIds,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onLoad,
  onMoveEnd,
  cursor = 'auto',
  children,
}: MapContainerLibreProps) {
  return (
    <Map
      ref={mapRef}
      mapStyle={OSM_STYLE_URL}
      initialViewState={{
        longitude: MAP_DEFAULTS.center[0],
        latitude: MAP_DEFAULTS.center[1],
        zoom: MAP_DEFAULTS.zoom,
      }}
      fadeDuration={0}
      interactiveLayerIds={interactiveLayerIds}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onLoad={onLoad}
      onMoveEnd={onMoveEnd}
      cursor={cursor}
      style={{ width: '100%', height: '100%' }}
      aria-label="Carte interactive"
    >
      <NavigationControl position="top-left" />
      {/*
        GeolocateControl : déclenchement uniquement sur clic utilisateur,
        jamais au chargement (RGPD & ADR-0011 §7).
        trackUserLocation={false} = affiche la position une fois, sans suivi continu.
      */}
      <GeolocateControl
        position="top-left"
        trackUserLocation={false}
        showUserHeading={false}
      />
      {children}
    </Map>
  )
}
