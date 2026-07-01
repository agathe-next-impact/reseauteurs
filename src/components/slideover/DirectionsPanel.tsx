'use client'

import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Car,
  Bike,
  Footprints,
  MapPinOff,
  TrafficCone,
  Clock,
  MapPin,
} from 'lucide-react'
import { formatDuration, formatDistance, getManeuverIcon } from '@/lib/mapbox/directions'
import type { DirectionsProfile, DirectionsRoute } from '@/types/map'

export interface DirectionsState {
  isOpen: boolean
  profile: DirectionsProfile
  setProfile: (p: DirectionsProfile) => void
  route: DirectionsRoute | null
  alternatives: DirectionsRoute[]
  loading: boolean
  geoError: boolean
  origin: [number, number] | null
  close: () => void
}

const PROFILES: { key: DirectionsProfile; Icon: typeof Car; label: string }[] = [
  { key: 'driving', Icon: Car, label: 'Voiture' },
  { key: 'driving-traffic', Icon: TrafficCone, label: 'Trafic' },
  { key: 'cycling', Icon: Bike, label: 'Velo' },
  { key: 'walking', Icon: Footprints, label: 'A pied' },
]

interface DirectionsPanelProps {
  directions: DirectionsState
  destinationLabel: string
  destinationSub?: string
  accentColor?: string
  onBack: () => void
  backLabel: string
  onStepClick?: (location: [number, number]) => void
}

export default function DirectionsPanel({
  directions,
  destinationLabel,
  destinationSub,
  accentColor = '#6b7280',
  onBack,
  backLabel,
  onStepClick,
}: DirectionsPanelProps) {
  // ETA : capture l'heure courante via useEffect plutot qu'en render pour
  // eviter l'appel de Date.now() (impur) pendant le render. setArrivalLabel
  // est différé via queueMicrotask pour eviter le warning "setState sync in
  // effect" du React compiler — le label est mis a jour au tick suivant,
  // imperceptible UX.
  const [arrivalLabel, setArrivalLabel] = useState<string | null>(null)
  useEffect(() => {
    const route = directions.route
    queueMicrotask(() => {
      if (!route) {
        setArrivalLabel(null)
        return
      }
      setArrivalLabel(
        new Date(Date.now() + route.duration * 1000).toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      )
    })
  }, [directions.route])

  return (
    <div>
      {/* Header — back button */}
      <div className="flex items-center gap-2 pt-2 md:pt-8 mb-2 md:mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-primary hover:text-primary-hover transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} />
          {backLabel}
        </button>
      </div>

      {/* Destination compact */}
      <div className="flex items-center gap-2 mb-2 md:mb-4 p-2 md:p-3 bg-gray-50 rounded-lg">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: accentColor }}
        >
          <MapPin size={14} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-dark truncate">{destinationLabel}</p>
          {destinationSub && <p className="text-sm text-text-light">{destinationSub}</p>}
        </div>
      </div>

      {/* Profile selector */}
      <div className="flex gap-1.5 mb-2 md:mb-4">
        {PROFILES.map(({ key, Icon, label }) => (
          <button
            key={key}
            onClick={() => directions.setProfile(key)}
            className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              directions.profile === key
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Geolocation error */}
      {directions.geoError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
          <MapPinOff size={14} className="shrink-0 mt-0.5" />
          <span>
            Impossible d&apos;obtenir votre position. Activez la géolocalisation dans les paramètres de votre navigateur puis réessayez.
          </span>
        </div>
      )}

      {/* Loading */}
      {directions.loading && (
        <div className="space-y-3 mb-4">
          <div className="animate-pulse h-12 bg-gray-100 rounded-lg" />
          <div className="animate-pulse h-8 bg-gray-100 rounded-lg" />
          <div className="animate-pulse h-8 bg-gray-100 rounded-lg" />
        </div>
      )}

      {/* Route summary */}
      {directions.route && !directions.loading && (
        <>
          <div className="flex items-center gap-4 p-3 bg-blue-50 border border-blue-100 rounded-lg mb-4">
            <div>
              <p className="text-lg font-bold text-text-dark">
                {formatDuration(directions.route.duration)}
              </p>
              <p className="text-sm text-text-medium">
                {formatDistance(directions.route.distance)}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-1.5 text-sm text-text-light">
              <Clock size={12} />
              <span>Arrivee ~ {arrivalLabel}</span>
            </div>
          </div>

          {/* Alternatives */}
          {directions.alternatives.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-text-light uppercase tracking-wide mb-2">
                Itineraires alternatifs
              </p>
              <div className="space-y-1.5">
                {directions.alternatives.map((alt, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 text-sm text-text-medium"
                  >
                    <span className="font-medium">{formatDuration(alt.duration)}</span>
                    <span className="text-text-light">{formatDistance(alt.distance)}</span>
                    {alt.legs?.[0]?.summary && (
                      <span className="text-sm text-text-light truncate ml-auto">
                        via {alt.legs[0].summary}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Congestion legend for traffic profile */}
          {directions.profile === 'driving-traffic' &&
            directions.route.legs?.[0]?.annotation?.congestion && (
              <div className="flex items-center gap-3 mb-4 text-sm text-text-light">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-1.5 rounded-full bg-[#3b82f6]" /> Fluide
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-1.5 rounded-full bg-[#f59e0b]" /> Modere
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-1.5 rounded-full bg-[#ef4444]" /> Dense
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-1.5 rounded-full bg-[#991b1b]" /> Bloque
                </span>
              </div>
            )}

          {/* Turn-by-turn instructions */}
          {directions.route.legs?.[0]?.steps && (
            <div>
              <p className="text-sm font-medium text-text-light uppercase tracking-wide mb-2">
                Instructions
              </p>
              <ol className="space-y-0.5">
                {directions.route.legs[0].steps.map((step, i) => {
                  const Icon = getManeuverIcon(step.maneuver.type, step.maneuver.modifier)
                  return (
                    <li key={i}>
                      <button
                        onClick={() => onStepClick?.(step.maneuver.location)}
                        className="w-full flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left cursor-pointer group"
                      >
                        <div className="w-7 h-7 rounded-full bg-gray-100 group-hover:bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Icon size={14} className="text-gray-500 group-hover:text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text-dark leading-snug">
                            {step.maneuver.instruction}
                          </p>
                          <p className="text-sm text-text-light mt-0.5">
                            {formatDistance(step.distance)}
                            {step.duration > 0 && ` · ${formatDuration(step.duration)}`}
                          </p>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </div>
          )}
        </>
      )}
    </div>
  )
}
