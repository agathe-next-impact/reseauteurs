'use client'
/**
 * MapEvenementsReseauteursLoader — Wrapper d'import dynamique (ssr: false) pour MapEvenementsReseauteurs.
 *
 * Usage :
 *   import MapEvenementsReseauteursLoader from '@/components/maps/MapEvenementsReseauteursLoader'
 *   <MapEvenementsReseauteursLoader initialData={...} reseaux={...} />
 */

import dynamic from 'next/dynamic'
import MapSkeleton from '@/components/maps/MapSkeleton'
import type { GeoJSONFeatureCollection } from '@/lib/geojson'
import type { ReseauLiteFilter } from '@/components/filters/FiltresEvenementsReseauteurs'

const MapEvenementsReseauteurs = dynamic(() => import('./MapEvenementsReseauteurs'), {
  ssr: false,
  loading: () => <MapSkeleton />,
})

interface MapEvenementsReseauteursLoaderProps {
  initialData: GeoJSONFeatureCollection
  initialSlug?: string | null
  reseaux: ReseauLiteFilter[]
  /** Bascule agenda/carte (rendue dans la barre de navigation supérieure). */
  toolbar?: React.ReactNode
}

export default function MapEvenementsReseauteursLoader(
  props: MapEvenementsReseauteursLoaderProps,
) {
  return <MapEvenementsReseauteurs {...props} />
}
