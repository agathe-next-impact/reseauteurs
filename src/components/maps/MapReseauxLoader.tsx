'use client'
/**
 * MapReseauxLoader — Wrapper d'import dynamique (ssr: false) pour MapReseaux.
 *
 * MapLibre GL JS utilise des APIs navigateur (WebGL, DOM) incompatibles avec le SSR.
 * Ce composant est le point d'entrée à utiliser dans les Server Components (pages).
 *
 * Usage dans une page (frontend-builder E2.C) :
 *   import MapReseauxLoader from '@/components/maps/MapReseauxLoader'
 *   import type { NationalLite } from '@/components/filters/FiltresReseaux'
 *
 *   <MapReseauxLoader
 *     initialData={geojsonLocaux}
 *     initialSlug={searchParams.res ?? null}
 *     nationals={nationals}
 *   />
 *
 * Propriétés exportées pour le parent :
 *   - initialData  : GeoJSONFeatureCollection des réseaux locaux (vue initiale France)
 *   - initialSlug  : slug d'un réseau présélectionné (depuis l'URL ?res=...)
 *   - nationals    : liste des réseaux nationaux pour le filtre parent
 */

import dynamic from 'next/dynamic'
import MapSkeleton from '@/components/maps/MapSkeleton'
import type { GeoJSONFeatureCollection } from '@/lib/geojson'
import type { NationalLite } from '@/components/filters/FiltresReseaux'

const MapReseaux = dynamic(() => import('./MapReseaux'), {
  ssr: false,
  loading: () => <MapSkeleton />,
})

export interface MapReseauxLoaderProps {
  initialData: GeoJSONFeatureCollection
  initialSlug?: string | null
  nationals: NationalLite[]
}

export default function MapReseauxLoader(props: MapReseauxLoaderProps) {
  return <MapReseaux {...props} />
}
