'use client'

import { Car, Bike, Footprints, X, MapPinOff } from 'lucide-react'
import type { DirectionsProfile, DirectionsRoute } from '@/types/map'
import { formatDuration, formatDistance } from '@/lib/mapbox/directions'

interface RouteControlsProps {
  profile: DirectionsProfile
  onProfileChange: (p: DirectionsProfile) => void
  route: DirectionsRoute | null
  loading: boolean
  geoError: boolean
  onClose: () => void
}

const PROFILES: { key: DirectionsProfile; Icon: typeof Car; label: string }[] = [
  { key: 'driving', Icon: Car, label: 'Voiture' },
  { key: 'cycling', Icon: Bike, label: 'Velo' },
  { key: 'walking', Icon: Footprints, label: 'A pied' },
]

export default function RouteControls({
  profile,
  onProfileChange,
  route,
  loading,
  geoError,
  onClose,
}: RouteControlsProps) {
  return (
    <div className="absolute top-3 right-3 z-[800] bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-72">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Itineraire</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 cursor-pointer"
          aria-label="Fermer l'itineraire"
        >
          <X size={16} />
        </button>
      </div>

      {/* Profile selector */}
      <div className="flex gap-2 mb-3">
        {PROFILES.map(({ key, Icon, label }) => (
          <button
            key={key}
            onClick={() => onProfileChange(key)}
            className={`flex-1 flex flex-col items-center gap-1 py-2 rounded text-sm font-medium transition-colors cursor-pointer ${
              profile === key
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            aria-label={label}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Geolocation error */}
      {geoError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-md p-2.5 mb-3 text-sm text-red-700">
          <MapPinOff size={14} className="shrink-0 mt-0.5" />
          <span>
            Impossible d&apos;obtenir votre position. Activez la géolocalisation dans les paramètres de votre navigateur puis réessayez.
          </span>
        </div>
      )}

      {/* Duration & distance */}
      {loading && <div className="animate-pulse h-8 bg-gray-100 rounded mb-3" />}
      {route && !loading && (
        <div className="flex gap-4 text-sm text-gray-700 mb-3">
          <span className="font-medium">{formatDuration(route.duration)}</span>
          <span className="text-gray-500">{formatDistance(route.distance)}</span>
        </div>
      )}

      {/* Turn-by-turn instructions */}
      {route?.legs?.[0]?.steps && !loading && (
        <details className="text-sm text-gray-600">
          <summary className="cursor-pointer text-sm font-medium mb-1">Instructions</summary>
          <ol className="list-decimal pl-4 space-y-1 max-h-48 overflow-y-auto">
            {route.legs[0].steps.map((step, i) => (
              <li key={i}>{step.maneuver.instruction}</li>
            ))}
          </ol>
        </details>
      )}
    </div>
  )
}
