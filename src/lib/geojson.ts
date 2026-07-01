export interface GeoJSONFeature {
  type: 'Feature'
  geometry: {
    type: 'Point'
    coordinates: [number, number]
  }
  properties: Record<string, unknown>
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
}

export function toFeature(
  lng: number,
  lat: number,
  properties: Record<string, unknown>,
): GeoJSONFeature {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties,
  }
}

export function toFeatureCollection(features: GeoJSONFeature[]): GeoJSONFeatureCollection {
  return { type: 'FeatureCollection', features }
}
