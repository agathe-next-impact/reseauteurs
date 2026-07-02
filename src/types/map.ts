/** Géométrie LineString GeoJSON (type local — évite une dépendance @types/geojson). */
type LineString = { type: 'LineString'; coordinates: number[][] }

export type DirectionsProfile = 'driving' | 'driving-traffic' | 'walking' | 'cycling'

export interface DirectionsRoute {
  geometry: LineString
  duration: number // seconds
  distance: number // meters
  weight_name: string
  weight: number
  legs: DirectionsLeg[]
}

export type CongestionLevel = 'unknown' | 'low' | 'moderate' | 'heavy' | 'severe'

export interface DirectionsLeg {
  duration: number
  distance: number
  steps: DirectionsStep[]
  summary: string
  annotation?: {
    congestion?: CongestionLevel[]
    duration?: number[]
    distance?: number[]
  }
}

export interface DirectionsStep {
  duration: number
  distance: number
  geometry: LineString
  name: string
  maneuver: {
    type: string
    instruction: string
    modifier?: string
    bearing_before: number
    bearing_after: number
    location: [number, number]
  }
}

export interface DirectionsResponse {
  routes: DirectionsRoute[]
  waypoints: { name: string; location: [number, number] }[]
  code: string
  message?: string
}

export interface POIInfo {
  longitude: number
  latitude: number
  name: string
  category: string
}

export interface TooltipInfo {
  longitude: number
  latitude: number
  title: string
  subtitle?: string
  logoUrl?: string | null
}
