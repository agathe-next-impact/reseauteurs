'use client'
/**
 * MapContainerLibre — Conteneur de carte MapLibre GL JS (ADR-0006).
 * Remplace MapContainer.tsx (Mapbox) pour les nouvelles cartes RÉSEAUTEURS.
 * Pas de token requis : tuiles OSM (OpenFreeMap clair / CARTO dark-matter sombre).
 *
 * - Basemap theme-adaptatif : suit le thème `.ir-plasma` (clair ⇆ sombre) et
 *   réagit à l'événement `reseauteurs-theme-change` (bascule header).
 * - Contrôles rebrandés (MapControls) au lieu des contrôles natifs MapLibre.
 */

import { useEffect, useState } from 'react'
import { Map } from 'react-map-gl/maplibre'
import type { MapRef, MapMouseEvent, MapEvent } from 'react-map-gl/maplibre'
import { FRANCE_BOUNDS, FRANCE_FIT_PADDING, MAP_STYLE_LIGHT, MAP_STYLE_DARK } from '@/lib/maplibre/config'
import MapControls from './MapControls'
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

/** Lit le thème courant depuis le DOM et réagit à la bascule header. */
function useDarkBasemap() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const read = () => setDark(document.body.classList.contains('ir-plasma'))
    read()
    window.addEventListener('reseauteurs-theme-change', read)
    return () => window.removeEventListener('reseauteurs-theme-change', read)
  }, [])
  return dark
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
  const dark = useDarkBasemap()

  return (
    <div className="rsn-map-shell">
      <Map
        ref={mapRef}
        mapStyle={dark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
        initialViewState={{
          // fitBounds sur l'emprise France : toute la France visible quel que
          // soit le viewport (un zoom fixe coupait le nord/la Corse sur mobile).
          bounds: FRANCE_BOUNDS,
          fitBoundsOptions: { padding: FRANCE_FIT_PADDING },
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
        {children}
      </Map>

      {/* Contrôles maison (zoom / autour de moi / recentrer). Géoloc au clic
          uniquement, jamais au chargement (RGPD & ADR-0011 §7). */}
      <MapControls mapRef={mapRef} />
    </div>
  )
}
