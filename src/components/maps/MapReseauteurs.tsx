// @ts-nocheck — types en attente de generate:types + versions MapLibre (map-engineer)
'use client'

/**
 * MapReseauteurs — Carte des réseauteurs (ADR-0006, ADR-0011).
 *
 * Marqueur = une personne (position au niveau ville/commune — RGPD ADR-0011 §7).
 * Clustering avec compteurs côté MapLibre GL JS.
 * Filtres : secteur / réseau / badge / ville.
 * Pas d'axe date (un réseauteur est persistant — DESIGN.md §6).
 *
 * Mobile : carte plein écran + bottom-sheet slide-over (pattern DESIGN.md §6).
 * Performance : requêtes bornées par bbox, MAX_RESULTS = 3000.
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Source, Layer } from 'react-map-gl/maplibre'
import type { MapRef, MapMouseEvent, MapEvent } from 'react-map-gl/maplibre'
import type { GeoJSONFeatureCollection } from '@/lib/geojson'
import type { TooltipInfo } from '@/types/map'
import { MAP_COLORS } from '@/lib/maplibre/config'
import FiltresReseauteurs, {
  type ReseauteurFilters,
  emptyFilters,
  type CategoryLite,
  type ReseauLite,
} from '@/components/filters/FiltresReseauteurs'

const SlideOverReseauteur = dynamic(() => import('@/components/slideover/SlideOverReseauteur'), {
  ssr: false,
})
import MapContainerLibre from '@/components/map/MapContainerLibre'
import MapPopupLibre from '@/components/map/MapPopupLibre'

/** Durée de debounce pour le refetch sur déplacement carte (ms) */
const MAP_MOVE_DEBOUNCE = 400

// ── Expressions MapLibre pour les couleurs de cluster ──────────────────────
const clusterCircleColor = [
  'step',
  ['get', 'point_count'],
  MAP_COLORS.primary,          // 1–19 points
  20, '#1d4ed8',               // 20–49
  50, '#1e40af',               // 50+
]

interface MapReseauteursProps {
  initialData: GeoJSONFeatureCollection
  initialSlug?: string | null
  categories: CategoryLite[]
  reseaux: ReseauLite[]
}

export default function MapReseauteurs({
  initialData,
  initialSlug,
  categories,
  reseaux,
}: MapReseauteursProps) {
  const mapRef = useRef<MapRef | null>(null)

  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug ?? null)
  const [filters, setFilters] = useState<ReseauteurFilters>(emptyFilters)
  const [fetching, setFetching] = useState(false)
  const [geojsonData, setGeojsonData] = useState<GeoJSONFeatureCollection>(initialData)
  const [resultCount, setResultCount] = useState(initialData.features.length)
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)
  const [cursor, setCursor] = useState('auto')
  const [mapReady, setMapReady] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cacheRef = useRef<Map<string, GeoJSONFeatureCollection>>(new Map())
  const geojsonDataRef = useRef(geojsonData)
  geojsonDataRef.current = geojsonData

  const sourceData = useMemo(() => geojsonData as GeoJSON.FeatureCollection, [geojsonData])

  // Filtre de sélection (marqueur actif)
  const selectedFilter = useMemo(
    (): unknown[] => ['==', ['get', 'slug'], selectedSlug ?? ''],
    [selectedSlug],
  )

  const interactiveLayerIds = useMemo(
    () => ['reseauteurs-clusters', 'reseauteurs-points'],
    [],
  )

  // ── Handlers carte ──────────────────────────────────────────────────
  const handleLoad = useCallback((e: MapEvent) => {
    const map = e.target
    map.once('idle', () => setMapReady(true))
  }, [])

  const handleClick = useCallback((e: MapMouseEvent) => {
    const feature = e.features?.[0]
    if (!feature) return

    const layerId = feature.layer?.id

    if (layerId === 'reseauteurs-clusters') {
      const map = mapRef.current?.getMap()
      if (!map) return
      const source = map.getSource('reseauteurs') as {
        getClusterExpansionZoom: (
          clusterId: number,
          cb: (err: unknown, zoom: number | null) => void,
        ) => void
      }
      const clusterId = feature.properties?.cluster_id as number
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err || zoom == null) return
        map.easeTo({
          center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
          zoom,
        })
      })
      return
    }

    if (layerId === 'reseauteurs-points') {
      const slug = feature.properties?.slug as string | undefined
      if (slug) {
        setSelectedSlug(slug)
        window.history.replaceState(
          null,
          '',
          `/carte/reseauteurs?r=${encodeURIComponent(slug)}`,
        )
      }
    }
  }, [])

  const handleMouseEnter = useCallback((e: MapMouseEvent) => {
    setCursor('pointer')
    const feature = e.features?.[0]
    if (!feature || feature.layer?.id !== 'reseauteurs-points') return
    const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number]
    setTooltip({
      longitude: coords[0],
      latitude: coords[1],
      title:
        [
          feature.properties?.prenom as string | undefined,
          feature.properties?.nom as string | undefined,
        ]
          .filter(Boolean)
          .join(' ') || 'Réseauteur',
      subtitle: (feature.properties?.ville as string | undefined) ?? undefined,
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setCursor('auto')
    setTooltip(null)
  }, [])

  // ── Refetch sur déplacement carte (bbox) ────────────────────────────
  const fetchWithBbox = useCallback(
    async (f: ReseauteurFilters) => {
      const map = mapRef.current?.getMap()
      const bounds = map?.getBounds()

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const params = new URLSearchParams()
      if (bounds) {
        params.set('sw_lng', String(bounds.getWest()))
        params.set('sw_lat', String(bounds.getSouth()))
        params.set('ne_lng', String(bounds.getEast()))
        params.set('ne_lat', String(bounds.getNorth()))
      }
      if (f.secteur) params.set('secteur', f.secteur)
      if (f.reseau) params.set('reseau', f.reseau)
      if (f.badge) params.set('badge', f.badge)
      if (f.ville.trim()) params.set('ville', f.ville.trim())

      const cacheKey = params.toString()
      const cached = cacheRef.current.get(cacheKey)
      if (cached) {
        setGeojsonData(cached)
        setResultCount(cached.features.length)
        return
      }

      setFetching(true)
      try {
        const res = await fetch(`/api/geo/reseauteurs?${params}`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`Geo reseauteurs: ${res.status}`)
        const json = await res.json() as GeoJSONFeatureCollection
        // Limiter la taille du cache (20 entrées max)
        if (cacheRef.current.size >= 20) {
          cacheRef.current.delete(cacheRef.current.keys().next().value!)
        }
        cacheRef.current.set(cacheKey, json)
        setGeojsonData(json)
        setResultCount(json.features.length)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        console.error('[MapReseauteurs] fetchWithBbox error:', err)
      } finally {
        setFetching(false)
      }
    },
    [],
  )

  const handleMoveEnd = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchWithBbox(filters), MAP_MOVE_DEBOUNCE)
  }, [fetchWithBbox, filters])

  const handleFilterChange = useCallback(
    (f: ReseauteurFilters) => {
      setFilters(f)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => fetchWithBbox(f), MAP_MOVE_DEBOUNCE)
    },
    [fetchWithBbox],
  )

  const handleClose = useCallback(() => {
    setSelectedSlug(null)
    window.history.replaceState(null, '', '/carte/reseauteurs')
  }, [])

  // Nettoyage des timers
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [])

  return (
    <div className="flex h-[calc(100dvh-4rem-1px)]" aria-label="Carte des réseauteurs">
      <FiltresReseauteurs
        filters={filters}
        onFilterChange={handleFilterChange}
        resultCount={resultCount}
        categories={categories}
        reseaux={reseaux}
      />

      <div className="flex-1 relative isolate">
        {/* Overlay de chargement initial */}
        <div
          className={`absolute inset-0 z-[700] bg-white flex items-center justify-center pointer-events-none transition-opacity duration-500 ${
            mapReady ? 'opacity-0' : 'opacity-100'
          }`}
          onTransitionEnd={(e) => {
            if (mapReady) (e.currentTarget as HTMLElement).style.display = 'none'
          }}
          aria-hidden="true"
        >
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-full bg-[#2563EB]"
                style={{ animation: `dotBounce 1.4s ease-in-out ${i * 0.16}s infinite` }}
              />
            ))}
          </div>
        </div>

        {/* Indicateur de refetch */}
        {fetching && (
          <div
            className="absolute inset-0 z-[600] bg-white/30 flex items-start justify-center pt-4 pointer-events-none"
            aria-hidden="true"
          >
            <div className="bg-white rounded-full px-3 py-1 shadow text-xs text-[#2563EB] font-medium flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#2563EB] animate-pulse" />
              Mise à jour...
            </div>
          </div>
        )}

        {/* Carte MapLibre */}
        <MapContainerLibre
          mapRef={mapRef}
          interactiveLayerIds={interactiveLayerIds}
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onLoad={handleLoad}
          onMoveEnd={handleMoveEnd}
          cursor={cursor}
        >
          {mapReady && (
            <Source
              id="reseauteurs"
              type="geojson"
              data={sourceData}
              cluster
              clusterMaxZoom={13}
              clusterRadius={40}
            >
              {/* Cercles des clusters */}
              <Layer
                id="reseauteurs-clusters"
                type="circle"
                filter={['has', 'point_count']}
                paint={{
                  'circle-color': clusterCircleColor as unknown as string,
                  'circle-radius': [
                    'step',
                    ['get', 'point_count'],
                    18,   // < 20
                    20, 24, // 20–49
                    50, 30, // 50+
                  ] as unknown as number,
                  'circle-stroke-width': 2,
                  'circle-stroke-color': MAP_COLORS.white,
                }}
              />
              {/* Compteurs des clusters */}
              <Layer
                id="reseauteurs-cluster-count"
                type="symbol"
                filter={['has', 'point_count']}
                layout={{
                  'text-field': '{point_count_abbreviated}',
                  'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                  'text-size': 12,
                } as unknown as Record<string, unknown>}
                paint={{ 'text-color': '#ffffff' }}
              />
              {/* Marqueurs individuels — cercle bleu */}
              <Layer
                id="reseauteurs-points"
                type="circle"
                filter={['!', ['has', 'point_count']]}
                paint={{
                  'circle-color': MAP_COLORS.primary,
                  'circle-radius': 9,
                  'circle-stroke-width': 2.5,
                  'circle-stroke-color': MAP_COLORS.white,
                }}
              />
              {/* Anneau de sélection */}
              <Layer
                id="reseauteurs-selected"
                type="circle"
                filter={selectedFilter as unknown as boolean}
                paint={{
                  'circle-color': 'transparent',
                  'circle-radius': 15,
                  'circle-stroke-width': 3,
                  'circle-stroke-color': MAP_COLORS.primary,
                }}
              />
            </Source>
          )}

          {/* Tooltip au survol */}
          {tooltip && (
            <MapPopupLibre
              longitude={tooltip.longitude}
              latitude={tooltip.latitude}
              onClose={() => setTooltip(null)}
              closeButton={false}
              offset={12}
              className="map-tooltip"
            >
              <div className="flex items-center gap-2">
                {tooltip.logoUrl && (
                  <img
                    src={tooltip.logoUrl}
                    alt=""
                    width={24}
                    height={24}
                    className="rounded-full object-cover shrink-0"
                  />
                )}
                <div>
                  <strong className="text-sm">{tooltip.title}</strong>
                  {tooltip.subtitle && (
                    <div className="text-xs text-[#71717a] mt-0.5">{tooltip.subtitle}</div>
                  )}
                </div>
              </div>
            </MapPopupLibre>
          )}
        </MapContainerLibre>
      </div>

      {/* Panneau de détail (slide-over + bottom-sheet mobile) */}
      <SlideOverReseauteur slug={selectedSlug} onClose={handleClose} />
    </div>
  )
}
