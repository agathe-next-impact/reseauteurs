'use client'
/**
 * MiniMap — Mini-carte d'un point unique (J3 intégration).
 *
 * Affiche un seul marqueur (le `geom` de l'entité) sur une carte MapLibre/OSM
 * compacte. Utilisée sur les fiches :
 *   - réseauteur → centroïde ville (RGPD ADR-0011 §7, pas d'adresse perso)
 *   - événement  → lieu de l'événement
 *   - réseau     → siège du réseau
 *
 * Réutilise OSM_STYLE_URL / MAP_COLORS de la config map-engineer (ADR-0006).
 * scrollZoom désactivé pour ne pas piéger le scroll de la page ; pan/zoom tactile
 * et boutons conservés. Aucun appel réseau (point statique passé en props).
 *
 * ADR-0012 : le marqueur événement est toujours `MAP_COLORS.evenement` — plus de Premium.
 */

import { Map, Marker, NavigationControl } from 'react-map-gl/maplibre'
import { OSM_STYLE_URL, MAP_COLORS } from '@/lib/maplibre/config'
import 'maplibre-gl/dist/maplibre-gl.css'

export interface MiniMapProps {
  latitude: number
  longitude: number
  zoom?: number
  /** Couleur du marqueur (token RÉSEAUTEURS). */
  color?: string
  /** Texte accessible décrivant le point affiché. */
  label?: string
}

export default function MiniMap({
  latitude,
  longitude,
  zoom = 12,
  color = MAP_COLORS.primary,
  label,
}: MiniMapProps) {
  return (
    <div
      className="h-48 w-full rounded-xl overflow-hidden border border-[#DFE0E1]"
      role="img"
      aria-label={label ?? 'Localisation sur la carte'}
    >
      <Map
        mapStyle={OSM_STYLE_URL}
        initialViewState={{ longitude, latitude, zoom }}
        scrollZoom={false}
        dragRotate={false}
        pitchWithRotate={false}
        fadeDuration={0}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <Marker longitude={longitude} latitude={latitude} anchor="bottom">
          <span
            aria-hidden
            style={{
              display: 'block',
              width: 18,
              height: 18,
              borderRadius: '50% 50% 50% 0',
              transform: 'rotate(-45deg)',
              background: color,
              border: '2px solid #ffffff',
            }}
          />
        </Marker>
      </Map>
    </div>
  )
}
