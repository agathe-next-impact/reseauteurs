'use client'

/**
 * MapControls — contrôles carte maison (rebrandés, theme-adaptatifs).
 * Remplace NavigationControl/GeolocateControl natifs de MapLibre pour coller
 * au design RÉSEAUTEURS (angles francs, tokens --ir-*).
 *
 * - Zoom + / −
 * - Autour de moi (géolocalisation au CLIC uniquement — RGPD ADR-0011 §7)
 * - Recentrer sur la France
 */

import { useState } from 'react'
import { Plus, Minus, LocateFixed, Loader2, Frame } from 'lucide-react'
import { MAP_DEFAULTS } from '@/lib/maplibre/config'

interface MapControlsProps {
  /** Ref vers le composant react-map-gl <Map> (expose getMap()). */
  mapRef: React.RefObject<{ getMap: () => import('maplibre-gl').Map } | null>
}

export default function MapControls({ mapRef }: MapControlsProps) {
  const [locating, setLocating] = useState(false)

  const getMap = () => mapRef.current?.getMap()

  const zoomBy = (delta: number) => {
    const map = getMap()
    if (!map) return
    map.easeTo({ zoom: map.getZoom() + delta, duration: 240 })
  }

  const recenter = () => {
    const map = getMap()
    if (!map) return
    map.flyTo({
      center: MAP_DEFAULTS.center as [number, number],
      zoom: MAP_DEFAULTS.zoom,
      duration: 900,
    })
  }

  const locate = () => {
    const map = getMap()
    if (!map || !('geolocation' in navigator)) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        map.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 11,
          duration: 1100,
        })
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    )
  }

  return (
    <div className="rsn-map-controls" role="group" aria-label="Contrôles de la carte">
      <div className="rsn-map-ctrl-group">
        <button
          type="button"
          className="rsn-map-ctrl"
          onClick={() => zoomBy(1)}
          aria-label="Zoomer"
          title="Zoomer"
        >
          <Plus size={17} aria-hidden />
        </button>
        <button
          type="button"
          className="rsn-map-ctrl"
          onClick={() => zoomBy(-1)}
          aria-label="Dézoomer"
          title="Dézoomer"
        >
          <Minus size={17} aria-hidden />
        </button>
      </div>

      <button
        type="button"
        className="rsn-map-ctrl rsn-map-ctrl-solo"
        onClick={locate}
        disabled={locating}
        aria-label="Me localiser (autour de moi)"
        title="Autour de moi"
      >
        {locating ? (
          <Loader2 size={16} aria-hidden className="animate-spin" />
        ) : (
          <LocateFixed size={16} aria-hidden />
        )}
      </button>

      <button
        type="button"
        className="rsn-map-ctrl rsn-map-ctrl-solo"
        onClick={recenter}
        aria-label="Recentrer sur la France"
        title="Recentrer sur la France"
      >
        <Frame size={16} aria-hidden />
      </button>
    </div>
  )
}
