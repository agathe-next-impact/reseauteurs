interface GeoResult {
  latitude: number
  longitude: number
}

export async function geocodeAddress(
  adresse: string | undefined | null,
  codePostal: string | undefined | null,
  ville: string,
): Promise<GeoResult | null> {
  const parts = [adresse, codePostal, ville].filter(Boolean).join(' ')
  if (!parts.trim()) return null

  try {
    const url = new URL('https://api-adresse.data.gouv.fr/search')
    url.searchParams.set('q', parts)
    url.searchParams.set('limit', '1')

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null

    const data = await res.json()
    const feature = data?.features?.[0]
    if (!feature?.geometry?.coordinates) return null

    const [longitude, latitude] = feature.geometry.coordinates
    return { latitude, longitude }
  } catch {
    console.warn(`[geocode] Failed to geocode: "${parts}"`)
    return null
  }
}
