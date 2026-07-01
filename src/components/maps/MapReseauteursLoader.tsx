'use client'
/**
 * MapReseauteursLoader — Wrapper d'import dynamique (ssr: false) pour MapReseauteurs.
 *
 * MapLibre GL JS utilise des APIs navigateur (WebGL, DOM) incompatibles avec le SSR.
 * Ce composant est le point d'entrée à utiliser dans les pages Server Components.
 *
 * Usage :
 *   import MapReseauteursLoader from '@/components/maps/MapReseauteursLoader'
 *   <MapReseauteursLoader initialData={...} categories={...} reseaux={...} />
 */

import dynamic from 'next/dynamic'
import MapSkeleton from '@/components/maps/MapSkeleton'
import type { GeoJSONFeatureCollection } from '@/lib/geojson'
import type { CategoryLite, ReseauLite } from '@/components/filters/FiltresReseauteurs'

const MapReseauteurs = dynamic(() => import('./MapReseauteurs'), {
  ssr: false,
  loading: () => <MapSkeleton />,
})

interface MapReseauteursLoaderProps {
  initialData: GeoJSONFeatureCollection
  initialSlug?: string | null
  categories: CategoryLite[]
  reseaux: ReseauLite[]
}

export default function MapReseauteursLoader(props: MapReseauteursLoaderProps) {
  return <MapReseauteurs {...props} />
}
