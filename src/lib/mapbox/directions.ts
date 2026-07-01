import type { DirectionsProfile, DirectionsResponse } from '@/types/map'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  CornerUpLeft,
  CornerUpRight,
  CornerDownLeft,
  CornerDownRight,
  MapPin,
  RotateCcw,
  GitMerge,
  GitBranch,
  LogOut,
  CircleDot,
} from 'lucide-react'

/** Map Mapbox maneuver type + modifier to a Lucide icon */
export function getManeuverIcon(type: string, modifier?: string): LucideIcon {
  if (type === 'arrive') return MapPin
  if (type === 'depart') return CircleDot
  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn') return RotateCcw
  if (type === 'merge') return GitMerge
  if (type === 'fork') return GitBranch
  if (type === 'off ramp' || type === 'on ramp') return LogOut

  // Direction-based
  switch (modifier) {
    case 'left':
      return ArrowLeft
    case 'right':
      return ArrowRight
    case 'sharp left':
      return CornerDownLeft
    case 'sharp right':
      return CornerDownRight
    case 'slight left':
      return CornerUpLeft
    case 'slight right':
      return CornerUpRight
    case 'uturn':
      return RotateCcw
    default:
      return ArrowUp
  }
}

export async function fetchDirections(
  coordinates: [number, number][],
  profile: DirectionsProfile = 'driving',
  signal?: AbortSignal,
): Promise<DirectionsResponse> {
  const coordString = coordinates.map((c) => c.join(',')).join(';')
  const res = await fetch(
    `/api/directions?coordinates=${encodeURIComponent(coordString)}&profile=${profile}`,
    { signal },
  )
  if (!res.ok) {
    throw new Error(`Directions API error: ${res.status}`)
  }
  return res.json()
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  if (hours > 0) return `${hours} h ${minutes} min`
  return `${minutes} min`
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`
  }
  return `${Math.round(meters)} m`
}
