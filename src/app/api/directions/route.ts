import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { rateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/client-ip'

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN

const VALID_PROFILES = new Set(['driving', 'driving-traffic', 'walking', 'cycling'])

// Mapbox Directions API hard limit — keeps upstream cost + latency bounded.
const MAX_WAYPOINTS = 25

function validateCoordinates(coords: string): boolean {
  const pairs = coords.split(';')
  if (pairs.length < 2 || pairs.length > MAX_WAYPOINTS) return false
  for (const pair of pairs) {
    const [lngStr, latStr] = pair.split(',')
    const lng = Number(lngStr)
    const lat = Number(latStr)
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return false
  }
  return true
}

export async function GET(request: NextRequest) {
  if (!MAPBOX_TOKEN) {
    return NextResponse.json({ error: 'Token serveur non configuré' }, { status: 500 })
  }

  // Rate limiting: 60 requests/min per IP
  const hdrs = await headers()
  const ip = getClientIp(hdrs)
  const { success: allowed } = rateLimit(`directions:${ip}`, { limit: 60, windowMs: 60_000 })
  if (!allowed) {
    return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })
  }

  const { searchParams } = request.nextUrl
  const coordinates = searchParams.get('coordinates')
  const profile = searchParams.get('profile') ?? 'driving'

  if (!coordinates) {
    return NextResponse.json({ error: 'Paramètre de coordonnées manquant' }, { status: 400 })
  }

  if (!VALID_PROFILES.has(profile)) {
    return NextResponse.json({ error: 'Profil invalide' }, { status: 400 })
  }

  if (!validateCoordinates(coordinates)) {
    return NextResponse.json(
      {
        error: `Coordonnées invalides (format attendu : lng,lat;lng,lat avec 2 à ${MAX_WAYPOINTS} points)`,
      },
      { status: 400 },
    )
  }

  const url = new URL(
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}`,
  )
  url.searchParams.set('geometries', 'geojson')
  url.searchParams.set('overview', 'full')
  url.searchParams.set('steps', 'true')
  url.searchParams.set('language', 'fr')
  url.searchParams.set('alternatives', 'true')
  url.searchParams.set('annotations', 'congestion,duration,distance')
  url.searchParams.set('access_token', MAPBOX_TOKEN)

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null)

  if (!res) {
    return NextResponse.json({ error: 'Délai d\'attente de l\'API Mapbox dépassé' }, { status: 504 })
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: 'Erreur de l\'API Mapbox Directions' },
      { status: res.status },
    )
  }

  const data = await res.json()
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
  })
}
